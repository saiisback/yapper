use starknet::ContractAddress;

#[starknet::interface]
pub trait IVote<TContractState> {
    fn react(ref self: TContractState, review_id: u64, reaction_type: u8);
    fn remove_reaction(ref self: TContractState, review_id: u64);
    fn get_reaction_count(self: @TContractState, review_id: u64, reaction_type: u8) -> u64;
    fn get_user_reaction(self: @TContractState, review_id: u64, user: ContractAddress) -> u8;
    fn get_owner(self: @TContractState) -> ContractAddress;
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
}

#[starknet::contract]
pub mod VoteContract {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry, Map,
    };
    use core::poseidon::poseidon_hash_span;

    // Reaction types
    pub const FIRE: u8 = 1;
    pub const SKULL: u8 = 2;
    pub const LOVE: u8 = 3;
    pub const GROSS: u8 = 4;
    pub const CAP: u8 = 5;
    // Internal: no reaction (storage default)
    pub const NO_REACTION: u8 = 0;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        paused: bool,
        // (review_id, reaction_type) -> count
        reaction_counts: Map<felt252, u64>,
        // hash(review_id, voter) -> reaction_type (0 = no reaction)
        user_reactions: Map<felt252, u8>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ReactionCast: ReactionCast,
        ReactionRemoved: ReactionRemoved,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ReactionCast {
        #[key]
        pub review_id: u64,
        pub voter: ContractAddress,
        pub reaction_type: u8,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ReactionRemoved {
        #[key]
        pub review_id: u64,
        pub voter: ContractAddress,
        pub previous_reaction: u8,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.paused.write(false);
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

    fn _user_reaction_key(review_id: u64, voter: ContractAddress) -> felt252 {
        let mut input = array![];
        input.append(review_id.into());
        input.append(voter.into());
        poseidon_hash_span(input.span())
    }

    fn _reaction_count_key(review_id: u64, reaction_type: u8) -> felt252 {
        let mut input = array![];
        input.append(review_id.into());
        input.append(reaction_type.into());
        poseidon_hash_span(input.span())
    }

    fn _is_valid_reaction(reaction_type: u8) -> bool {
        reaction_type == FIRE
            || reaction_type == SKULL
            || reaction_type == LOVE
            || reaction_type == GROSS
            || reaction_type == CAP
    }

    #[abi(embed_v0)]
    impl VoteImpl of super::IVote<ContractState> {
        fn react(ref self: ContractState, review_id: u64, reaction_type: u8) {
            _assert_not_paused(@self);
            assert(_is_valid_reaction(reaction_type), 'Invalid reaction type');

            let caller = get_caller_address();
            let user_key = _user_reaction_key(review_id, caller);
            let previous = self.user_reactions.entry(user_key).read();

            // If same reaction already cast, do nothing
            if previous == reaction_type {
                return;
            }

            // Remove previous reaction count if one existed
            if previous != NO_REACTION {
                let prev_count_key = _reaction_count_key(review_id, previous);
                let prev_count = self.reaction_counts.entry(prev_count_key).read();
                if prev_count > 0 {
                    self.reaction_counts.entry(prev_count_key).write(prev_count - 1);
                }
            }

            // Add new reaction count
            let new_count_key = _reaction_count_key(review_id, reaction_type);
            let current_count = self.reaction_counts.entry(new_count_key).read();
            self.reaction_counts.entry(new_count_key).write(current_count + 1);

            // Store user's reaction
            self.user_reactions.entry(user_key).write(reaction_type);

            self.emit(ReactionCast { review_id, voter: caller, reaction_type });
        }

        fn remove_reaction(ref self: ContractState, review_id: u64) {
            _assert_not_paused(@self);

            let caller = get_caller_address();
            let user_key = _user_reaction_key(review_id, caller);
            let previous = self.user_reactions.entry(user_key).read();

            assert(previous != NO_REACTION, 'No reaction to remove');

            // Decrement count
            let count_key = _reaction_count_key(review_id, previous);
            let count = self.reaction_counts.entry(count_key).read();
            if count > 0 {
                self.reaction_counts.entry(count_key).write(count - 1);
            }

            // Clear user's reaction
            self.user_reactions.entry(user_key).write(NO_REACTION);

            self.emit(ReactionRemoved { review_id, voter: caller, previous_reaction: previous });
        }

        fn get_reaction_count(
            self: @ContractState, review_id: u64, reaction_type: u8,
        ) -> u64 {
            let count_key = _reaction_count_key(review_id, reaction_type);
            self.reaction_counts.entry(count_key).read()
        }

        fn get_user_reaction(
            self: @ContractState, review_id: u64, user: ContractAddress,
        ) -> u8 {
            let user_key = _user_reaction_key(review_id, user);
            self.user_reactions.entry(user_key).read()
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
