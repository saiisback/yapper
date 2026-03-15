use starknet::ContractAddress;

#[derive(Drop, Serde, starknet::Store)]
pub struct Entity {
    pub entity_type: u8,
    pub metadata_hash: felt252,
    pub creator: ContractAddress,
    pub timestamp: u64,
}

#[starknet::interface]
pub trait IEntity<TContractState> {
    fn add_entity(ref self: TContractState, entity_type: u8, metadata_hash: felt252) -> u64;
    fn get_entity(self: @TContractState, entity_id: u64) -> (u8, felt252, ContractAddress, u64);
}

#[starknet::contract]
pub mod EntityContract {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry, Map,
    };
    use super::Entity;

    // Entity type constants
    pub const PLACE: u8 = 1;
    pub const CREATOR: u8 = 2;
    pub const PRODUCT: u8 = 3;

    #[storage]
    struct Storage {
        next_entity_id: u64,
        entities_entity_type: Map<u64, u8>,
        entities_metadata_hash: Map<u64, felt252>,
        entities_creator: Map<u64, ContractAddress>,
        entities_timestamp: Map<u64, u64>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        EntityAdded: EntityAdded,
    }

    #[derive(Drop, starknet::Event)]
    pub struct EntityAdded {
        #[key]
        pub entity_id: u64,
        pub entity_type: u8,
        pub metadata_hash: felt252,
        pub creator: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.next_entity_id.write(1);
    }

    #[abi(embed_v0)]
    impl EntityImpl of super::IEntity<ContractState> {
        fn add_entity(
            ref self: ContractState, entity_type: u8, metadata_hash: felt252,
        ) -> u64 {
            assert(
                entity_type == PLACE || entity_type == CREATOR || entity_type == PRODUCT,
                'Invalid entity type',
            );
            assert(metadata_hash != 0, 'Metadata hash cannot be zero');

            let caller = get_caller_address();
            let entity_id = self.next_entity_id.read();
            let timestamp = get_block_timestamp();

            self.entities_entity_type.entry(entity_id).write(entity_type);
            self.entities_metadata_hash.entry(entity_id).write(metadata_hash);
            self.entities_creator.entry(entity_id).write(caller);
            self.entities_timestamp.entry(entity_id).write(timestamp);

            self.next_entity_id.write(entity_id + 1);

            self.emit(EntityAdded { entity_id, entity_type, metadata_hash, creator: caller });

            entity_id
        }

        fn get_entity(
            self: @ContractState, entity_id: u64,
        ) -> (u8, felt252, ContractAddress, u64) {
            let entity_type = self.entities_entity_type.entry(entity_id).read();
            assert(entity_type != 0, 'Entity does not exist');

            let metadata_hash = self.entities_metadata_hash.entry(entity_id).read();
            let creator = self.entities_creator.entry(entity_id).read();
            let timestamp = self.entities_timestamp.entry(entity_id).read();

            (entity_type, metadata_hash, creator, timestamp)
        }
    }
}
