use starknet::ContractAddress;

#[derive(Drop, Serde, starknet::Store)]
pub struct Review {
    pub entity_id: u64,
    pub content_hash: felt252,
    pub rating: u8,
    pub author: ContractAddress,
    pub identity_mode: u8,
    pub timestamp: u64,
}

#[starknet::interface]
pub trait IReview<TContractState> {
    fn post_review(
        ref self: TContractState,
        entity_id: u64,
        content_hash: felt252,
        rating: u8,
        identity_mode: u8,
    );
    fn get_review(
        self: @TContractState, review_id: u64,
    ) -> (u64, felt252, u8, ContractAddress, u8, u64);
    fn get_entity_review_count(self: @TContractState, entity_id: u64) -> u64;
}

#[starknet::contract]
pub mod ReviewContract {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry, Map,
    };
    use core::poseidon::poseidon_hash_span;

    #[storage]
    struct Storage {
        next_review_id: u64,
        // Review fields stored flat
        reviews_entity_id: Map<u64, u64>,
        reviews_content_hash: Map<u64, felt252>,
        reviews_rating: Map<u64, u8>,
        reviews_author: Map<u64, ContractAddress>,
        reviews_identity_mode: Map<u64, u8>,
        reviews_timestamp: Map<u64, u64>,
        // Count of reviews per entity
        entity_review_count: Map<u64, u64>,
        // Tracks whether a user already reviewed an entity: hash(entity_id, user) -> bool
        user_entity_review: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ReviewPosted: ReviewPosted,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ReviewPosted {
        #[key]
        pub review_id: u64,
        #[key]
        pub entity_id: u64,
        pub content_hash: felt252,
        pub rating: u8,
        pub author: ContractAddress,
        pub identity_mode: u8,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.next_review_id.write(1);
    }

    fn _user_entity_key(entity_id: u64, user: ContractAddress) -> felt252 {
        let mut input = array![];
        input.append(entity_id.into());
        input.append(user.into());
        poseidon_hash_span(input.span())
    }

    #[abi(embed_v0)]
    impl ReviewImpl of super::IReview<ContractState> {
        fn post_review(
            ref self: ContractState,
            entity_id: u64,
            content_hash: felt252,
            rating: u8,
            identity_mode: u8,
        ) {
            assert(rating >= 1 && rating <= 5, 'Rating must be between 1 and 5');
            assert(content_hash != 0, 'Content hash cannot be zero');

            let caller = get_caller_address();
            let key = _user_entity_key(entity_id, caller);

            let already_reviewed = self.user_entity_review.entry(key).read();
            assert(!already_reviewed, 'Already reviewed this entity');

            let review_id = self.next_review_id.read();
            let timestamp = get_block_timestamp();

            self.reviews_entity_id.entry(review_id).write(entity_id);
            self.reviews_content_hash.entry(review_id).write(content_hash);
            self.reviews_rating.entry(review_id).write(rating);
            self.reviews_author.entry(review_id).write(caller);
            self.reviews_identity_mode.entry(review_id).write(identity_mode);
            self.reviews_timestamp.entry(review_id).write(timestamp);

            self.user_entity_review.entry(key).write(true);

            let current_count = self.entity_review_count.entry(entity_id).read();
            self.entity_review_count.entry(entity_id).write(current_count + 1);

            self.next_review_id.write(review_id + 1);

            self
                .emit(
                    ReviewPosted {
                        review_id, entity_id, content_hash, rating, author: caller, identity_mode,
                    },
                );
        }

        fn get_review(
            self: @ContractState, review_id: u64,
        ) -> (u64, felt252, u8, ContractAddress, u8, u64) {
            let rating = self.reviews_rating.entry(review_id).read();
            assert(rating != 0, 'Review does not exist');

            let entity_id = self.reviews_entity_id.entry(review_id).read();
            let content_hash = self.reviews_content_hash.entry(review_id).read();
            let author = self.reviews_author.entry(review_id).read();
            let identity_mode = self.reviews_identity_mode.entry(review_id).read();
            let timestamp = self.reviews_timestamp.entry(review_id).read();

            (entity_id, content_hash, rating, author, identity_mode, timestamp)
        }

        fn get_entity_review_count(self: @ContractState, entity_id: u64) -> u64 {
            self.entity_review_count.entry(entity_id).read()
        }
    }
}
