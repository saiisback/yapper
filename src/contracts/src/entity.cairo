use starknet::ContractAddress;

#[starknet::interface]
pub trait IEntity<TContractState> {
    fn add_entity(ref self: TContractState, entity_type: u8, metadata_hash: felt252) -> u64;
    fn get_entity(self: @TContractState, entity_id: u64) -> (u8, felt252, ContractAddress, u64);
    fn get_entity_count(self: @TContractState) -> u64;
    fn get_owner(self: @TContractState) -> ContractAddress;
    fn transfer_ownership(ref self: TContractState, new_owner: ContractAddress);
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
}

#[starknet::contract]
pub mod EntityContract {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry, Map,
    };

    pub const PLACE: u8 = 1;
    pub const CREATOR: u8 = 2;
    pub const PRODUCT: u8 = 3;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        paused: bool,
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
        OwnershipTransferred: OwnershipTransferred,
    }

    #[derive(Drop, starknet::Event)]
    pub struct EntityAdded {
        #[key]
        pub entity_id: u64,
        pub entity_type: u8,
        pub metadata_hash: felt252,
        pub creator: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct OwnershipTransferred {
        pub previous_owner: ContractAddress,
        pub new_owner: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.paused.write(false);
        self.next_entity_id.write(1);
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

    #[abi(embed_v0)]
    impl EntityImpl of super::IEntity<ContractState> {
        fn add_entity(
            ref self: ContractState, entity_type: u8, metadata_hash: felt252,
        ) -> u64 {
            _assert_not_paused(@self);
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

        fn get_entity_count(self: @ContractState) -> u64 {
            self.next_entity_id.read() - 1
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn transfer_ownership(ref self: ContractState, new_owner: ContractAddress) {
            _assert_owner(@self);
            let previous_owner = self.owner.read();
            self.owner.write(new_owner);
            self.emit(OwnershipTransferred { previous_owner, new_owner });
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
