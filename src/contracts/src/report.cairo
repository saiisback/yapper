use starknet::ContractAddress;

#[starknet::interface]
pub trait IReport<TContractState> {
    fn report(ref self: TContractState, review_id: u64, reason_code: u8);
    fn is_hidden(self: @TContractState, review_id: u64) -> bool;
    fn get_report_count(self: @TContractState, review_id: u64) -> u64;
}

#[starknet::contract]
pub mod ReportContract {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry, Map,
    };
    use core::poseidon::poseidon_hash_span;

    pub const REPORT_THRESHOLD: u64 = 10;

    #[storage]
    struct Storage {
        // review_id -> report count
        report_counts: Map<u64, u64>,
        // hash(review_id, reporter) -> has reported (bool)
        user_reports: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ReviewReported: ReviewReported,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ReviewReported {
        #[key]
        pub review_id: u64,
        pub reporter: ContractAddress,
        pub reason_code: u8,
        pub total_reports: u64,
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
        }

        fn is_hidden(self: @ContractState, review_id: u64) -> bool {
            let count = self.report_counts.entry(review_id).read();
            count >= REPORT_THRESHOLD
        }

        fn get_report_count(self: @ContractState, review_id: u64) -> u64 {
            self.report_counts.entry(review_id).read()
        }
    }
}
