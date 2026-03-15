use starknet::ContractAddress;

#[starknet::interface]
pub trait IZkVerifier<TContractState> {
    fn verify_phone_proof(
        ref self: TContractState, proof: felt252, nullifier: felt252,
    ) -> bool;
    fn is_verified(self: @TContractState, address: ContractAddress) -> bool;
}

#[starknet::contract]
pub mod ZkVerifierContract {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry, Map,
    };

    #[storage]
    struct Storage {
        // nullifier -> already used
        verified_nullifiers: Map<felt252, bool>,
        // address -> is verified
        verified_addresses: Map<ContractAddress, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        UserVerified: UserVerified,
    }

    #[derive(Drop, starknet::Event)]
    pub struct UserVerified {
        #[key]
        pub user: ContractAddress,
        pub nullifier: felt252,
    }

    #[abi(embed_v0)]
    impl ZkVerifierImpl of super::IZkVerifier<ContractState> {
        fn verify_phone_proof(
            ref self: ContractState, proof: felt252, nullifier: felt252,
        ) -> bool {
            assert(proof != 0, 'Proof cannot be zero');
            assert(nullifier != 0, 'Nullifier cannot be zero');

            let caller = get_caller_address();

            // Check caller is not already verified
            let already_verified = self.verified_addresses.entry(caller).read();
            assert(!already_verified, 'Address already verified');

            // Check nullifier has not been used (prevents double-registration)
            let nullifier_used = self.verified_nullifiers.entry(nullifier).read();
            assert(!nullifier_used, 'Nullifier already used');

            // In production, actual ZK proof verification logic would go here.
            // For now, we accept the proof as valid if it is non-zero.

            // Mark nullifier as used
            self.verified_nullifiers.entry(nullifier).write(true);

            // Mark address as verified
            self.verified_addresses.entry(caller).write(true);

            self.emit(UserVerified { user: caller, nullifier });

            true
        }

        fn is_verified(self: @ContractState, address: ContractAddress) -> bool {
            self.verified_addresses.entry(address).read()
        }
    }
}
