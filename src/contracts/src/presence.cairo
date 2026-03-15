use starknet::ContractAddress;

#[starknet::interface]
pub trait IPresence<TContractState> {
    fn create_event(
        ref self: TContractState,
        entity_id: u64,
        name_hash: felt252,
        start_time: u64,
        end_time: u64,
        latitude: felt252,
        longitude: felt252,
        radius: u64,
    ) -> u64;
    fn submit_proof(
        ref self: TContractState,
        entity_id: u64,
        event_id: u64,
        photo_hash: felt252,
        user_latitude: felt252,
        user_longitude: felt252,
    ) -> u64;
    fn get_event(
        self: @TContractState, event_id: u64,
    ) -> (u64, felt252, u64, u64, felt252, felt252, ContractAddress, u64);
    fn get_event_count(self: @TContractState) -> u64;
    fn get_proof(
        self: @TContractState, proof_id: u64,
    ) -> (ContractAddress, u64, u64, felt252, felt252, felt252, u64);
    fn get_user_proof_count(self: @TContractState, user: ContractAddress) -> u64;
    fn get_entity_proof_count(self: @TContractState, entity_id: u64) -> u64;
    fn get_user_entity_proof_today(
        self: @TContractState, user: ContractAddress, entity_id: u64,
    ) -> bool;
    fn get_owner(self: @TContractState) -> ContractAddress;
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
}

#[starknet::contract]
pub mod PresenceContract {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry, Map,
    };
    use core::poseidon::poseidon_hash_span;

    const SECONDS_PER_DAY: u64 = 86400;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        paused: bool,
        // Events
        next_event_id: u64,
        events_entity_id: Map<u64, u64>,
        events_name_hash: Map<u64, felt252>,
        events_start_time: Map<u64, u64>,
        events_end_time: Map<u64, u64>,
        events_latitude: Map<u64, felt252>,
        events_longitude: Map<u64, felt252>,
        events_creator: Map<u64, ContractAddress>,
        events_radius: Map<u64, u64>,
        // Proofs
        next_proof_id: u64,
        proofs_user: Map<u64, ContractAddress>,
        proofs_entity_id: Map<u64, u64>,
        proofs_event_id: Map<u64, u64>,
        proofs_photo_hash: Map<u64, felt252>,
        proofs_user_latitude: Map<u64, felt252>,
        proofs_user_longitude: Map<u64, felt252>,
        proofs_timestamp: Map<u64, u64>,
        // Counters
        user_proof_count: Map<ContractAddress, u64>,
        entity_proof_count: Map<u64, u64>,
        // Duplicate prevention: hash(user, entity_id, day) -> bool
        user_entity_day: Map<felt252, bool>,
        // One proof per user per event: hash(user, event_id) -> bool
        user_event_proof: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        EventCreated: EventCreated,
        ProofRecorded: ProofRecorded,
    }

    #[derive(Drop, starknet::Event)]
    pub struct EventCreated {
        #[key]
        pub event_id: u64,
        #[key]
        pub entity_id: u64,
        pub creator: ContractAddress,
        pub start_time: u64,
        pub end_time: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProofRecorded {
        #[key]
        pub proof_id: u64,
        #[key]
        pub user: ContractAddress,
        pub entity_id: u64,
        pub event_id: u64,
        pub photo_hash: felt252,
        pub timestamp: u64,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.paused.write(false);
        self.next_event_id.write(1);
        self.next_proof_id.write(1);
    }

    fn _assert_not_paused(self: @ContractState) {
        let is_paused = self.paused.read();
        assert(!is_paused, 'Contract is paused');
    }

    fn _assert_owner(self: @ContractState) {
        let caller = get_caller_address();
        let owner = self.owner.read();
        assert(caller == owner, 'Caller is not the owner');
    }

    fn _user_entity_day_key(
        user: ContractAddress, entity_id: u64, day: u64,
    ) -> felt252 {
        let mut input = array![];
        input.append(user.into());
        input.append(entity_id.into());
        input.append(day.into());
        poseidon_hash_span(input.span())
    }

    fn _user_event_key(user: ContractAddress, event_id: u64) -> felt252 {
        let mut input = array![];
        input.append(user.into());
        input.append(event_id.into());
        poseidon_hash_span(input.span())
    }

    #[abi(embed_v0)]
    impl PresenceImpl of super::IPresence<ContractState> {
        fn create_event(
            ref self: ContractState,
            entity_id: u64,
            name_hash: felt252,
            start_time: u64,
            end_time: u64,
            latitude: felt252,
            longitude: felt252,
            radius: u64,
        ) -> u64 {
            _assert_not_paused(@self);
            assert(name_hash != 0, 'Name hash cannot be zero');
            assert(start_time < end_time, 'Invalid time range');
            assert(radius > 0, 'Radius must be positive');

            let caller = get_caller_address();
            let event_id = self.next_event_id.read();

            self.events_entity_id.entry(event_id).write(entity_id);
            self.events_name_hash.entry(event_id).write(name_hash);
            self.events_start_time.entry(event_id).write(start_time);
            self.events_end_time.entry(event_id).write(end_time);
            self.events_latitude.entry(event_id).write(latitude);
            self.events_longitude.entry(event_id).write(longitude);
            self.events_creator.entry(event_id).write(caller);
            self.events_radius.entry(event_id).write(radius);

            self.next_event_id.write(event_id + 1);

            self.emit(EventCreated { event_id, entity_id, creator: caller, start_time, end_time });

            event_id
        }

        fn submit_proof(
            ref self: ContractState,
            entity_id: u64,
            event_id: u64,
            photo_hash: felt252,
            user_latitude: felt252,
            user_longitude: felt252,
        ) -> u64 {
            _assert_not_paused(@self);
            assert(photo_hash != 0, 'Photo hash cannot be zero');

            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let today = timestamp / SECONDS_PER_DAY;

            // One proof per user per entity per day
            let day_key = _user_entity_day_key(caller, entity_id, today);
            let already_today = self.user_entity_day.entry(day_key).read();
            assert(!already_today, 'Already proved today');

            // If event_id > 0, validate event timing and one-per-event
            if event_id > 0 {
                let ev_start = self.events_start_time.entry(event_id).read();
                let ev_end = self.events_end_time.entry(event_id).read();
                assert(ev_start > 0, 'Event does not exist');
                assert(timestamp >= ev_start, 'Event has not started');
                assert(timestamp <= ev_end, 'Event has ended');

                let ev_entity = self.events_entity_id.entry(event_id).read();
                assert(ev_entity == entity_id, 'Event entity mismatch');

                let event_key = _user_event_key(caller, event_id);
                let already_event = self.user_event_proof.entry(event_key).read();
                assert(!already_event, 'Already proved for event');
                self.user_event_proof.entry(event_key).write(true);
            }

            let proof_id = self.next_proof_id.read();

            self.proofs_user.entry(proof_id).write(caller);
            self.proofs_entity_id.entry(proof_id).write(entity_id);
            self.proofs_event_id.entry(proof_id).write(event_id);
            self.proofs_photo_hash.entry(proof_id).write(photo_hash);
            self.proofs_user_latitude.entry(proof_id).write(user_latitude);
            self.proofs_user_longitude.entry(proof_id).write(user_longitude);
            self.proofs_timestamp.entry(proof_id).write(timestamp);

            self.user_entity_day.entry(day_key).write(true);

            let user_count = self.user_proof_count.entry(caller).read();
            self.user_proof_count.entry(caller).write(user_count + 1);

            let entity_count = self.entity_proof_count.entry(entity_id).read();
            self.entity_proof_count.entry(entity_id).write(entity_count + 1);

            self.next_proof_id.write(proof_id + 1);

            self
                .emit(
                    ProofRecorded {
                        proof_id,
                        user: caller,
                        entity_id,
                        event_id,
                        photo_hash,
                        timestamp,
                    },
                );

            proof_id
        }

        fn get_event(
            self: @ContractState, event_id: u64,
        ) -> (u64, felt252, u64, u64, felt252, felt252, ContractAddress, u64) {
            let entity_id = self.events_entity_id.entry(event_id).read();
            let name_hash = self.events_name_hash.entry(event_id).read();
            assert(name_hash != 0, 'Event does not exist');

            let start_time = self.events_start_time.entry(event_id).read();
            let end_time = self.events_end_time.entry(event_id).read();
            let latitude = self.events_latitude.entry(event_id).read();
            let longitude = self.events_longitude.entry(event_id).read();
            let creator = self.events_creator.entry(event_id).read();
            let radius = self.events_radius.entry(event_id).read();

            (entity_id, name_hash, start_time, end_time, latitude, longitude, creator, radius)
        }

        fn get_event_count(self: @ContractState) -> u64 {
            self.next_event_id.read() - 1
        }

        fn get_proof(
            self: @ContractState, proof_id: u64,
        ) -> (ContractAddress, u64, u64, felt252, felt252, felt252, u64) {
            let user = self.proofs_user.entry(proof_id).read();
            let entity_id = self.proofs_entity_id.entry(proof_id).read();
            let event_id = self.proofs_event_id.entry(proof_id).read();
            let photo_hash = self.proofs_photo_hash.entry(proof_id).read();
            let user_latitude = self.proofs_user_latitude.entry(proof_id).read();
            let user_longitude = self.proofs_user_longitude.entry(proof_id).read();
            let timestamp = self.proofs_timestamp.entry(proof_id).read();

            (user, entity_id, event_id, photo_hash, user_latitude, user_longitude, timestamp)
        }

        fn get_user_proof_count(self: @ContractState, user: ContractAddress) -> u64 {
            self.user_proof_count.entry(user).read()
        }

        fn get_entity_proof_count(self: @ContractState, entity_id: u64) -> u64 {
            self.entity_proof_count.entry(entity_id).read()
        }

        fn get_user_entity_proof_today(
            self: @ContractState, user: ContractAddress, entity_id: u64,
        ) -> bool {
            let timestamp = get_block_timestamp();
            let today = timestamp / SECONDS_PER_DAY;
            let key = _user_entity_day_key(user, entity_id, today);
            self.user_entity_day.entry(key).read()
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn pause(ref self: ContractState) {
            _assert_owner(@self);
            self.paused.write(true);
        }

        fn unpause(ref self: ContractState) {
            _assert_owner(@self);
            self.paused.write(false);
        }
    }
}
