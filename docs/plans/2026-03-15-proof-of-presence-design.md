# Proof of Presence & Touch Grass Leaderboard — Design

## Overview

Two new features for StarkZap:

1. **Proof of Presence** — Users take photos at places/events, submit them on-chain with GPS coordinates as immutable proof they were there.
2. **Touch Grass Leaderboard** — Ranks users by unique places visited, encouraging real-world exploration.

New `/presence` tab in the app navigation, fully separate from the existing home feed.

---

## Cairo Contract: `presence.cairo`

### Events (on-chain struct)

| Field       | Type            | Description                                      |
|-------------|-----------------|--------------------------------------------------|
| event_id    | felt252         | Unique identifier                                |
| entity_id   | felt252         | Linked entity (place/creator/product)            |
| name_hash   | felt252         | IPFS hash of event name/description              |
| start_time  | u64             | Unix timestamp — event start                     |
| end_time    | u64             | Unix timestamp — event end                       |
| latitude    | felt252         | Entity GPS lat (scaled integer, e.g. 39.7392 → 397392) |
| longitude   | felt252         | Entity GPS lng (scaled integer)                  |
| creator     | ContractAddress | Who created the event                            |
| radius      | u64             | Allowed check-in radius in meters (default 500)  |

### Proof of Presence (on-chain struct)

| Field          | Type            | Description                              |
|----------------|-----------------|------------------------------------------|
| proof_id       | felt252         | Unique identifier                        |
| user           | ContractAddress | Who was present                          |
| entity_id      | felt252         | Which entity                             |
| event_id       | felt252         | Optional (0 if just a place proof)       |
| photo_hash     | felt252         | IPFS hash of photo                       |
| user_latitude  | felt252         | User's GPS lat at time of proof          |
| user_longitude | felt252         | User's GPS lng at time of proof          |
| timestamp      | u64             | Block timestamp                          |

### Contract Rules

- Events can only be created for existing entities
- Event proofs enforce `start_time <= block_timestamp <= end_time`
- One proof per user per entity per day (prevents spam)
- One proof per user per event (events are one-time)
- All data fully on-chain, photos referenced via IPFS hash
- GPS validation is client-side (500m radius); contract stores both entity and user coords for social verification

### Contract Functions

```
// Events
fn create_event(entity_id, name_hash, start_time, end_time, latitude, longitude, radius)
fn get_event(event_id) -> Event
fn get_event_count() -> u64

// Proof of Presence
fn submit_proof(entity_id, event_id, photo_hash, user_latitude, user_longitude)
fn get_proof(proof_id) -> Proof
fn get_user_proof_count(user) -> u64
fn get_entity_proof_count(entity_id) -> u64
fn get_user_entity_proof_today(user, entity_id) -> bool
```

### Events Emitted

- `ProofRecorded { proof_id, user, entity_id, event_id, photo_hash, timestamp }`
- `EventCreated { event_id, entity_id, creator, start_time, end_time }`

---

## Prisma Models

```prisma
model Event {
  id          String    @id
  entityId    String
  entity      Entity    @relation(fields: [entityId], references: [id])
  name        String
  description String?
  imageUrl    String?
  startTime   DateTime
  endTime     DateTime
  latitude    Float
  longitude   Float
  radius      Int       @default(500)
  creator     String
  proofCount  Int       @default(0)
  txHash      String
  createdAt   DateTime  @default(now())
  proofs      Proof[]

  @@index([entityId])
  @@index([startTime, endTime])
}

model Proof {
  id            String   @id
  userId        String
  entityId      String
  entity        Entity   @relation(fields: [entityId], references: [id])
  eventId       String?
  event         Event?   @relation(fields: [eventId], references: [id])
  photoHash     String
  photoUrl      String
  caption       String?
  userLatitude  Float
  userLongitude Float
  txHash        String
  createdAt     DateTime @default(now())

  @@unique([userId, eventId])
  @@index([userId])
  @@index([entityId])
  @@index([createdAt])
}
```

---

## Frontend

### Navigation

New "Presence" tab in NavBar (MapPin icon), between Explore and Profile.

### Page: `/presence`

Four sub-views toggled by pills at the top:

#### 1. Feed (default)
Scrollable feed of recent proofs from all users. Each card:
- User's photo (from IPFS)
- Entity name + event name (if event proof)
- Timestamp + distance badge ("was 120m away")
- User pseudonym or anonymous tag

#### 2. Events
List of active/upcoming events. Each card:
- Event name, entity name, date range
- Number of proofs so far
- "Prove Presence" button (enabled only if event is active)

#### 3. My Proofs
Personal history of all your proofs. Timeline view showing your proof-of-presence trail.

#### 4. Leaderboard (Touch Grass)
**Top 3 podium** — gold/silver/bronze styled cards:
- Rank, pseudonym, avatar
- Unique places count + total proofs count
- "Touch Grass Score" = unique entities visited

**Ranked list (4th+):**
- Rank, pseudonym, unique places, total proofs
- Current user's row highlighted/sticky at bottom

**Time filters:** All Time | This Month | This Week

**Scoring:**
- Primary sort: unique entities visited
- Tiebreaker: total number of proofs
- Event proofs count toward unique entities (via the entity behind the event)

### Proof Submission Flow

1. User taps FAB button on presence page
2. App requests camera + location permissions
3. User takes or selects a photo
4. App captures GPS, validates within 500m of nearest entity
5. User picks entity (auto-suggested by proximity) + optional active event
6. Adds optional caption
7. Submit → photo uploaded to Pinata → on-chain tx via paymaster → DB cache write
8. Success screen with shareable card

---

## API Routes

| Route                        | Method | Purpose                                           |
|------------------------------|--------|---------------------------------------------------|
| `/api/presence/checkin`      | POST   | Submit proof of presence                          |
| `/api/presence/feed`         | GET    | Recent proofs, paginated                          |
| `/api/presence/events`       | GET    | Active/upcoming events                            |
| `/api/presence/events`       | POST   | Create event for an entity                        |
| `/api/presence/my-proofs`    | GET    | Current user's proof history                      |
| `/api/presence/leaderboard`  | GET    | Ranked users, accepts time filter (all/month/week)|

### Submission Flow (server-side)

1. Receive photo + GPS + entity ID + event ID (optional) + caption
2. Upload photo to Pinata → get IPFS hash
3. Build tx: `presence.submit_proof(entity_id, event_id, photo_hash, lat, lng)`
4. Send via AVNU paymaster (gasless)
5. Contract validates: entity exists, event active (if event), no duplicate today/event
6. On success: write to Proof DB table, return proof ID + tx hash
7. Indexer webhook picks up `ProofRecorded` event as backup

### Leaderboard Query

```sql
SELECT user_id, pseudonym,
       COUNT(DISTINCT entity_id) as unique_places,
       COUNT(*) as total_proofs
FROM Proof
WHERE created_at >= [time_filter]
GROUP BY user_id
ORDER BY unique_places DESC, total_proofs DESC
```

---

## Implementation Checklist

- [ ] Write `presence.cairo` contract with events + proofs
- [ ] Add `Event` and `Proof` models to Prisma schema + migrate
- [ ] Deploy presence contract to Sepolia
- [ ] Add contract address to env vars
- [ ] Build `/api/presence/checkin` route
- [ ] Build `/api/presence/events` GET + POST routes
- [ ] Build `/api/presence/feed` route
- [ ] Build `/api/presence/my-proofs` route
- [ ] Build `/api/presence/leaderboard` route
- [ ] Add "Presence" tab to NavBar
- [ ] Build `/presence` page with pill navigation
- [ ] Build Feed sub-view with proof cards
- [ ] Build Events sub-view with event cards
- [ ] Build My Proofs sub-view with timeline
- [ ] Build Leaderboard sub-view with podium + ranked list
- [ ] Build proof submission flow (camera, GPS, entity picker, IPFS upload)
- [ ] Add GPS proximity validation (client-side 500m check)
- [ ] Add indexer webhook handler for `ProofRecorded` + `EventCreated`
- [ ] Test end-to-end on Sepolia
