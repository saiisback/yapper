use starknet::ContractAddress;

#[derive(Drop, Serde, starknet::Store)]
pub struct Profile {
    pub pseudonym: felt252,
    pub bio_hash: felt252,
    pub reputation: u64,
    pub zk_proof_hash: felt252,
}

#[starknet::interface]
pub trait IProfile<TContractState> {
    fn create_profile(ref self: TContractState, pseudonym: felt252, zk_proof_hash: felt252);
    fn get_profile(self: @TContractState, address: ContractAddress) -> (felt252, felt252, u64, felt252);
}

#[starknet::contract]
pub mod ProfileContract {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry, Map,
    };

    #[storage]
    struct Storage {
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
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProfileCreated {
        #[key]
        pub user: ContractAddress,
        pub pseudonym: felt252,
    }

    #[abi(embed_v0)]
    impl ProfileImpl of super::IProfile<ContractState> {
        fn create_profile(
            ref self: ContractState, pseudonym: felt252, zk_proof_hash: felt252,
        ) {
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
    }
}
