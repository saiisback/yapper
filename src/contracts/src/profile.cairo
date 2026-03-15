use starknet::ContractAddress;

#[starknet::interface]
pub trait IProfile<TContractState> {
    fn create_profile(ref self: TContractState, pseudonym: felt252, zk_proof_hash: felt252);
    fn update_bio(ref self: TContractState, bio_hash: felt252);
    fn update_pseudonym(ref self: TContractState, new_pseudonym: felt252);
    fn get_profile(
        self: @TContractState, address: ContractAddress,
    ) -> (felt252, felt252, u64, felt252);
    fn profile_exists(self: @TContractState, address: ContractAddress) -> bool;
    fn get_owner(self: @TContractState) -> ContractAddress;
    fn add_reputation(ref self: TContractState, user: ContractAddress, amount: u64);
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
}

#[starknet::contract]
pub mod ProfileContract {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry, Map,
    };

    #[storage]
    struct Storage {
        owner: ContractAddress,
        paused: bool,
        profiles_pseudonym: Map<ContractAddress, felt252>,
        profiles_bio_hash: Map<ContractAddress, felt252>,
        profiles_reputation: Map<ContractAddress, u64>,
        profiles_zk_proof_hash: Map<ContractAddress, felt252>,
        profiles_exists: Map<ContractAddress, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ProfileCreated: ProfileCreated,
        ProfileUpdated: ProfileUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProfileCreated {
        #[key]
        pub user: ContractAddress,
        pub pseudonym: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProfileUpdated {
        #[key]
        pub user: ContractAddress,
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

    #[abi(embed_v0)]
    impl ProfileImpl of super::IProfile<ContractState> {
        fn create_profile(
            ref self: ContractState, pseudonym: felt252, zk_proof_hash: felt252,
        ) {
            _assert_not_paused(@self);

            let caller = get_caller_address();

            let exists = self.profiles_exists.entry(caller).read();
            assert(!exists, 'Profile already exists');
            assert(pseudonym != 0, 'Pseudonym cannot be empty');

            self.profiles_pseudonym.entry(caller).write(pseudonym);
            self.profiles_bio_hash.entry(caller).write(0);
            self.profiles_reputation.entry(caller).write(0);
            self.profiles_zk_proof_hash.entry(caller).write(zk_proof_hash);
            self.profiles_exists.entry(caller).write(true);

            self.emit(ProfileCreated { user: caller, pseudonym });
        }

        fn update_bio(ref self: ContractState, bio_hash: felt252) {
            _assert_not_paused(@self);

            let caller = get_caller_address();
            let exists = self.profiles_exists.entry(caller).read();
            assert(exists, 'Profile does not exist');

            self.profiles_bio_hash.entry(caller).write(bio_hash);
            self.emit(ProfileUpdated { user: caller });
        }

        fn update_pseudonym(ref self: ContractState, new_pseudonym: felt252) {
            _assert_not_paused(@self);

            let caller = get_caller_address();
            let exists = self.profiles_exists.entry(caller).read();
            assert(exists, 'Profile does not exist');
            assert(new_pseudonym != 0, 'Pseudonym cannot be empty');

            self.profiles_pseudonym.entry(caller).write(new_pseudonym);
            self.emit(ProfileUpdated { user: caller });
        }

        fn get_profile(
            self: @ContractState, address: ContractAddress,
        ) -> (felt252, felt252, u64, felt252) {
            let exists = self.profiles_exists.entry(address).read();
            assert(exists, 'Profile does not exist');

            let pseudonym = self.profiles_pseudonym.entry(address).read();
            let bio_hash = self.profiles_bio_hash.entry(address).read();
            let reputation = self.profiles_reputation.entry(address).read();
            let zk_proof_hash = self.profiles_zk_proof_hash.entry(address).read();

            (pseudonym, bio_hash, reputation, zk_proof_hash)
        }

        fn profile_exists(self: @ContractState, address: ContractAddress) -> bool {
            self.profiles_exists.entry(address).read()
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn add_reputation(ref self: ContractState, user: ContractAddress, amount: u64) {
            _assert_owner(@self);
            let exists = self.profiles_exists.entry(user).read();
            assert(exists, 'Profile does not exist');

            let current = self.profiles_reputation.entry(user).read();
            self.profiles_reputation.entry(user).write(current + amount);
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
