use starknet::ContractAddress;

#[starknet::interface]
pub trait IReport<TContractState> {
    fn report(ref self: TContractState, review_id: u64, reason_code: u8);
    fn is_hidden(self: @TContractState, review_id: u64) -> bool;
    fn get_report_count(self: @TContractState, review_id: u64) -> u64;
    fn get_owner(self: @TContractState) -> ContractAddress;
    fn set_threshold(ref self: TContractState, new_threshold: u64);
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
}

#[starknet::contract]
pub mod ReportContract {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry, Map,
    };
    use core::poseidon::poseidon_hash_span;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        paused: bool,
        report_threshold: u64,
        report_counts: Map<u64, u64>,
        // hash(review_id, reporter) -> has reported
        user_reports: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ReviewReported: ReviewReported,
        ReviewHidden: ReviewHidden,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ReviewReported {
        #[key]
        pub review_id: u64,
        pub reporter: ContractAddress,
        pub reason_code: u8,
        pub total_reports: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ReviewHidden {
        #[key]
        pub review_id: u64,
        pub total_reports: u64,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.paused.write(false);
        self.report_threshold.write(10);
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

    fn _report_key(review_id: u64, reporter: ContractAddress) -> felt252 {
        let mut input = array![];
        input.append(review_id.into());
        input.append(reporter.into());
        poseidon_hash_span(input.span())
    }

    #[abi(embed_v0)]
    impl ReportImpl of super::IReport<ContractState> {
        fn report(ref self: ContractState, review_id: u64, reason_code: u8) {
            _assert_not_paused(@self);
            assert(reason_code > 0, 'Invalid reason code');

            let caller = get_caller_address();
            let key = _report_key(review_id, caller);

            let already_reported = self.user_reports.entry(key).read();
            assert(!already_reported, 'Already reported this review');

            self.user_reports.entry(key).write(true);

            let current_count = self.report_counts.entry(review_id).read();
            let new_count = current_count + 1;
            self.report_counts.entry(review_id).write(new_count);

            self
                .emit(
                    ReviewReported {
                        review_id, reporter: caller, reason_code, total_reports: new_count,
                    },
                );

            // Emit hidden event when threshold is crossed
            let threshold = self.report_threshold.read();
            if new_count == threshold {
                self.emit(ReviewHidden { review_id, total_reports: new_count });
            }
        }

        fn is_hidden(self: @ContractState, review_id: u64) -> bool {
            let count = self.report_counts.entry(review_id).read();
            let threshold = self.report_threshold.read();
            count >= threshold
        }

        fn get_report_count(self: @ContractState, review_id: u64) -> u64 {
            self.report_counts.entry(review_id).read()
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn set_threshold(ref self: ContractState, new_threshold: u64) {
            _assert_owner(@self);
            assert(new_threshold > 0, 'Threshold must be > 0');
            self.report_threshold.write(new_threshold);
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
