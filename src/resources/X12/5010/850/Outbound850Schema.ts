import { z } from "zod";
import { OutboundEventSchema } from "../../../../lib/types/OutboundEvent.js";

// auto-generated via https://stefanterdell.github.io/json-schema-to-zod-react/
const PayloadSchema = z
  .object({
    heading: z
      .object({
        transaction_set_header_ST: z
          .object({
            transaction_set_identifier_code_01: z.enum(["850"]).default("850"),
            transaction_set_control_number_02: z
              .number()
              .int()
              .gte(1)
              .lte(999999999),
          })
          .strict()
          .optional(),
        beginning_segment_for_purchase_order_BEG: z
          .object({
            transaction_set_purpose_code_01: z.enum(["00"]),
            purchase_order_type_code_02: z.enum(["DS", "SS"]),
            purchase_order_number_03: z.string().min(1).max(22),
            date_05: z.string(),
          })
          .strict(),
        reference_information_REF_division_code: z
          .array(
            z
              .object({
                reference_identification_qualifier_01: z.enum(["19", "CC"]),
                reference_identification_02: z.string().min(1).max(50),
              })
              .strict()
              .describe(
                "To add any additional routing information for Trading Partner divisions. Please reach out to Acme if you need this populated."
              )
          )
          .min(1)
          .optional(),
        reference_information_REF_customer_order: z
          .array(
            z
              .object({
                reference_identification_qualifier_01: z.enum(["CO"]),
                reference_identification_02: z
                  .string()
                  .min(1)
                  .max(50)
                  .describe(
                    "Reference information as defined for a particular Transaction Set or as specified by the Reference Identification Qualifier\n\n"
                  ),
              })
              .strict()
              .describe(
                "Indicates Acme's internal sales order number, available upon request."
              )
          )
          .min(1)
          .optional(),
        reference_information_REF_memo_field: z
          .array(
            z
              .object({
                reference_identification_qualifier_01: z.enum(["ZZ"]),
                reference_identification_02: z.string().min(1).max(50),
              })
              .strict()
              .describe("Optional memo field, available upon request")
          )
          .min(1)
          .optional(),
        administrative_communications_contact_PER: z
          .object({
            contact_function_code_01: z.enum(["OC"]),
            name_02: z.string().min(1).max(60),
            communication_number_qualifier_03: z.enum(["TE"]),
            communication_number_04: z.string().min(1).max(256),
            communication_number_qualifier_05: z.enum(["EM"]).optional(),
            communication_number_06: z.string().min(1).max(256).optional(),
          })
          .strict()
          .optional(),
        carrier_details_routing_sequence_transit_time_TD5: z
          .object({
            transportation_method_type_code_04: z.enum(["ZZ"]),
            routing_05: z
              .string()
              .min(1)
              .max(35)
              .describe(
                "Free-form description of the routing or requested routing for shipment, or the originating carrier's identity. \n\nFHD - FedEx Home Delivery\nFR - FedEx Freight"
              ),
          })
          .strict(),
        party_identification_N1_loop: z
          .array(
            z
              .object({
                party_identification_N1: z
                  .object({
                    entity_identifier_code_01: z.enum(["ST"]),
                    name_02: z.string().min(1).max(60),
                    identification_code_qualifier_03: z.enum(["92"]).optional(),
                    identification_code_04: z
                      .string()
                      .min(2)
                      .max(80)
                      .optional(),
                  })
                  .strict()
                  .describe(
                    "To identify a party by type of organization, name, and code. "
                  ),
                party_location_N3: z
                  .array(
                    z
                      .object({
                        address_information_01: z.string().min(1).max(55),
                        address_information_02: z
                          .string()
                          .min(1)
                          .max(55)
                          .optional(),
                      })
                      .strict()
                  )
                  .min(1)
                  .max(2),
                geographic_location_N4: z
                  .array(
                    z
                      .object({
                        city_name_01: z.string().min(2).max(30).optional(),
                        state_or_province_code_02: z
                          .string()
                          .min(2)
                          .max(2)
                          .optional(),
                        postal_code_03: z.string().min(3).max(15).optional(),
                        country_code_04: z.string().min(2).max(3).optional(),
                      })
                      .strict()
                      .describe(
                        "To specify the geographic place of the named party. \n\nA combination of N401 through N403 may be adequate to specify location\nN402 is required only if the city name (N401) is in the U.S. or Canada"
                      )
                  )
                  .min(1),
              })
              .strict()
          )
          .min(1)
          .max(1),
      })
      .strict(),
    detail: z
      .object({
        baseline_item_data_PO1_loop: z.array(
          z
            .object({
              baseline_item_data_PO1: z
                .object({
                  assigned_identification_01: z
                    .string()
                    .min(1)
                    .max(20)
                    .optional(),
                  quantity_02: z.string().min(4).max(100),
                  unit_or_basis_for_measurement_code_03: z.enum(["EA"]),
                  unit_price_04: z.number(),
                  product_service_id_qualifier_06: z.enum(["VC"]),
                  product_service_id_07: z
                    .string()
                    .min(1)
                    .max(48)
                    .describe(
                      "Identifying number for a product or service. Vendor's code."
                    ),
                  product_service_id_qualifier_08: z.enum(["SK"]),
                  product_service_id_09: z
                    .string()
                    .min(1)
                    .max(48)
                    .describe(
                      "Identifying number for a product or service. Acme's item SKU"
                    ),
                })
                .strict(),
              product_item_description_PID_loop: z.array(
                z
                  .object({
                    product_item_description_PID: z
                      .object({
                        item_description_type_01: z.enum(["F"]),
                        description_05: z
                          .string()
                          .min(1)
                          .max(80)
                          .describe(
                            "A free-form description to clarify the related data elements and their content. This contains Acme's description of the product."
                          )
                          .optional(),
                      })
                      .strict(),
                  })
                  .strict()
              ),
              service_promotion_allowance_or_charge_information_SAC_loop: z
                .object({
                  service_promotion_allowance_or_charge_information_SAC: z
                    .object({
                      allowance_or_charge_indicator_01: z.enum([
                        "A",
                        "C",
                        "P",
                        "S",
                      ]),
                      service_promotion_allowance_or_charge_code_02: z.enum([
                        "C310",
                        "E380",
                      ]),
                      amount_05: z
                        .number()
                        .multipleOf(0.01)
                        .gte(-999999999999999)
                        .lte(999999999999999),
                      description_15: z.string().min(1).max(80),
                    })
                    .strict(),
                })
                .strict()
                .optional(),
            })
            .strict()
        ),
      })
      .strict(),
    summary: z
      .object({
        transaction_totals_CTT_loop: z.array(
          z
            .object({
              transaction_totals_CTT: z
                .object({
                  number_of_line_items_01: z
                    .number()
                    .int()
                    .gte(-999999)
                    .lte(999999),
                })
                .strict(),
              monetary_amount_information_AMT: z
                .object({
                  amount_qualifier_code_01: z.enum(["TT"]),
                  monetary_amount_02: z.number(),
                })
                .strict(),
            })
            .strict()
        ),
        transaction_set_trailer_SE: z
          .object({
            number_of_included_segments_01: z
              .number()
              .int()
              .gte(-9999999999)
              .lte(9999999999),
            transaction_set_control_number_02: z
              .string()
              .min(4)
              .max(9)
              .describe(
                "Identifying control number that must be unique within the transaction set functional group assigned by the originator for a transaction set.\n\nSince AMT is in Summary TT must be used stating Transaction Total"
              ),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict();

export const Outbound850Schema = OutboundEventSchema.merge(
  z.strictObject({
    payload: PayloadSchema,
  })
);
