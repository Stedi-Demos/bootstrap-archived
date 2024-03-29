export default {
  metadata: {
    partnershipId: "this-is-me_another-merchant",
    usageIndicatorCode: "I",
    useBuiltInGuide: true,
  },
  payload: {
    heading: {
      transaction_set_header_ST: {
        transaction_set_identifier_code_01: "997",
        transaction_set_control_number_02: 1,
      },
      functional_group_response_header_AK1: {
        functional_identifier_code_01: "PO",
        group_control_number_02: 1921,
      },
      functional_group_response_trailer_AK9: {
        functional_group_acknowledge_code_01: "A",
        number_of_transaction_sets_included_02: 1,
        number_of_received_transaction_sets_03: 1,
        number_of_accepted_transaction_sets_04: 1,
      },
    },
  },
};
