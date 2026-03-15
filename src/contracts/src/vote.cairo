use starknet::ContractAddress;

#[starknet::interface]
pub trait IVote<TContractState> {
    fn vote(ref self: TContractState, review_id: u64, vote_type: u8);
    fn get_score(self: @TContractState, review_id: u64) -> i64;
}

#[starknet::contract]
pub mod VoteContract {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry, Map,
    };
    use core::poseidon::poseidon_hash_span;

    // Vote types
    pub const DOWNVOTE: u8 = 0;
    pub const UPVOTE: u8 = 1;
    // Internal: no vote cast yet
    const NO_VOTE: u8 = 255;

    #[storage]
    struct Storage {
        // review_id -> net score (stored as two u64s for positive/negative since no native i64
        // storage)
        review_upvotes: Map<u64, u64>,
        review_downvotes: Map<u64, u64>,
        // hash(review_id, voter) -> vote_type (255 = no vote)
        user_votes: Map<felt252, u8>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        VoteCast: VoteCast,
    }

    #[derive(Drop, starknet::Event)]
    pub struct VoteCast {
        #[key]
        pub review_id: u64,
        pub voter: ContractAddress,
        pub vote_type: u8,
    }

    fn _vote_key(review_id: u64, voter: ContractAddress) -> felt252 {
        let mut input = array![];
        input.append(review_id.into());
        input.append(voter.into());
        poseidon_hash_span(input.span())
    }

    #[abi(embed_v0)]
    impl VoteImpl of super::IVote<ContractState> {
        fn vote(ref self: ContractState, review_id: u64, vote_type: u8) {
            assert(vote_type == UPVOTE || vote_type == DOWNVOTE, 'Invalid vote type');

            let caller = get_caller_address();
            let key = _vote_key(review_id, caller);

            let previous_vote = self.user_votes.entry(key).read();

            // If user already cast the same vote, do nothing
            if previous_vote == vote_type {
                return;
            }

            // Remove previous vote effect if one exists
            // Storage default for u8 is 0 which collides with DOWNVOTE,
            // so we use a sentinel: we also store a "has_voted" flag.
            // Actually, let's use NO_VOTE (255) as sentinel. Default read is 0 which is DOWNVOTE.
            // We need a separate has_voted map. Let's handle it differently:
            // We'll treat default 0 as "no vote" by using a separate map.

            // Simpler approach: check a has_voted map
            // But to keep it simple with existing storage, let's offset: store vote_type + 1
            // 0 = no vote, 1 = downvote, 2 = upvote

            // Actually we already read previous_vote. Let's re-architect:
            // We store: 0 = never voted, 1 = downvote, 2 = upvote
            let stored_vote = previous_vote;
            let new_stored: u8 = vote_type + 1;

            // Undo previous vote
            if stored_vote == 2 {
                // Was upvote, remove it
                let ups = self.review_upvotes.entry(review_id).read();
                self.review_upvotes.entry(review_id).write(ups - 1);
            } else if stored_vote == 1 {
                // Was downvote, remove it
                let downs = self.review_downvotes.entry(review_id).read();
                self.review_downvotes.entry(review_id).write(downs - 1);
            }

            // Apply new vote
            if vote_type == UPVOTE {
                let ups = self.review_upvotes.entry(review_id).read();
                self.review_upvotes.entry(review_id).write(ups + 1);
            } else {
                let downs = self.review_downvotes.entry(review_id).read();
                self.review_downvotes.entry(review_id).write(downs + 1);
            }

            self.user_votes.entry(key).write(new_stored);

            self.emit(VoteCast { review_id, voter: caller, vote_type });
        }

        fn get_score(self: @ContractState, review_id: u64) -> i64 {
            let ups: u64 = self.review_upvotes.entry(review_id).read();
            let downs: u64 = self.review_downvotes.entry(review_id).read();

            let ups_i: i64 = ups.try_into().unwrap();
            let downs_i: i64 = downs.try_into().unwrap();

            ups_i - downs_i
        }
    }
}
