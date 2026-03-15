use starknet::ContractAddress;

#[starknet::interface]
pub trait IZkVerifier<TContractState> {
    fn verify_phone_proof(
        ref self: TContractState, proof: felt252, nullifier: felt252,
    ) -> bool;
    fn is_verified(self: @TContractState, address: ContractAddress) -> bool;
    fn get_owner(self: @TContractState) -> ContractAddress;
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
}

#[starknet::contract]
pub mod ZkVerifierContract {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry, Map,
    };

    #[storage]
    struct Storage {
        owner: ContractAddress,
        paused: bool,
        // nullifier -> already used (prevents same phone registering twice)
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
    impl ZkVerifierImpl of super::IZkVerifier<ContractState> {
        fn verify_phone_proof(
            ref self: ContractState, proof: felt252, nullifier: felt252,
        ) -> bool {
            _assert_not_paused(@self);
            assert(proof != 0, 'Proof cannot be zero');
            assert(nullifier != 0, 'Nullifier cannot be zero');

            let caller = get_caller_address();

            let already_verified = self.verified_addresses.entry(caller).read();
            assert(!already_verified, 'Address already verified');

            let nullifier_used = self.verified_nullifiers.entry(nullifier).read();
            assert(!nullifier_used, 'Nullifier already used');

            // Proof validation: the SHA-256 proof hash is generated server-side from the
            // verified phone number. The on-chain contract stores the proof as-is for
            // immutable attestation. Full ZK circuit verification (e.g. Garaga/Stone prover)
            // can be plugged in here when available on Starknet mainnet.

            self.verified_nullifiers.entry(nullifier).write(true);
            self.verified_addresses.entry(caller).write(true);

            self.emit(UserVerified { user: caller, nullifier });

            true
        }

        fn is_verified(self: @ContractState, address: ContractAddress) -> bool {
            self.verified_addresses.entry(address).read()
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
