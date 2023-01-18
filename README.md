# Stedi EDI Bootstrap

This repo contains an end-to-end configuration for building a full X12 EDI system using Stedi products. This implementation demonstrates one possible way to interact with Stedi's Products and APIs to achieve a typical EDI workload; your implementation may include some or all of these products depending on your particular systems and requirements.

To learn more about the repo and how it works, you can read more here in our docs: 
- [Bootstrap overview](https://www.stedi.com/docs/bootstrap)
- [Adjusting the workflow](https://www.stedi.com/docs/bootstrap/adjusting-the-workflow)
- [Understanding the workflow](https://www.stedi.com/docs/bootstrap/understanding-the-workflow)

# Prerequisites & Deployment

1. [Node.js](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) _(minimum version: 15)_

1. Clone this repo and install the necessary dependencies:

   ```bash
   git clone https://github.com/Stedi-Demos/bootstrap.git
   cd bootstrap
   npm ci
   ```

1. Go to [webhook.site](https://webhook.site/) and copy the unique URL. The demo will send output to this webhook.

1. This project uses `dotenv` to manage the environmental variables required. Rename the `.env.example` file to `.env` and amend the following variables:

   - `STEDI_API_KEY`: Your Stedi API Key - used to deploy the function and internally to interact with product APIs. If you don't already have one, you can generate an [API Key here](https://www.stedi.com/app/settings/api-keys).
   - `DESTINATION_WEBHOOK_URL`: the unique URL copied from [webhook.site](https://webhook.site/) in the previous step.

   Example `.env` file:

   ```
   STEDI_API_KEY=<YOUR_STEDI_API_KEY>
   DESTINATION_WEBHOOK_URL=<YOUR_WEBHOOK_URL>
   ```

1. To deploy the components:

   ```bash
   npm run bootstrap
   ```

## Testing the system

### Inbound EDI
The `inbound-edi` function will be invoked automatically when files are written to the SFTP bucket.

1. Using the [Buckets UI](https://www.stedi.com/app/buckets) navigate to the `inbound` directory for your trading partner: `<SFTP_BUCKET_NAME>/trading_partners/ANOTHERMERCH/inbound`

2. Upload the [input X12 5010 855 EDI](src/resources/X12/5010/855/inbound.edi) document to this directory. (_note_: if you upload the document to any directory not named `inbound`, it will be intentionally ignored by the `inbound-edi`).

3. Look for the output of the function wherever you created your test webhook! The function sends the JSON received from EDI Translate to the endpoint you have configured.

<details><summary>Example webhook output (click to expand):</summary>

   ```json
   {
     "delimiters": {
       "composite": ">",
       "element": "*",
       "repetition": "U",
       "segment": "~"
     },
     "envelope": {
       "interchangeHeader": {
         "authorizationInformationQualifier": "00",
         "authorizationInformation": "          ",
         "securityQualifier": "00",
         "securityInformation": "          ",
         "senderQualifier": "02",
         "senderId": "THISISME       ",
         "receiverQualifier": "ZZ",
         "receiverId": "ANOTHERMERCH   ",
         "date": "2004-08-05",
         "time": "06:24",
         "repetitionSeparator": "U",
         "controlVersionNumber": "00400",
         "controlNumber": "000000001",
         "acknowledgementRequestedCode": "0",
         "usageIndicatorCode": "P",
         "componentSeparator": ">"
       },
       "groupHeader": {
         "functionalIdentifierCode": "IM",
         "applicationSenderCode": "CNWY",
         "applicationReceiverCode": "GSRECEIVERID",
         "date": "2004-08-05",
         "time": "06:24",
         "controlNumber": "000000001",
         "agencyCode": "X",
         "release": "004010"
       },
       "groupTrailer": {
         "numberOfTransactions": "1",
         "controlNumber": "000000001"
       },
       "interchangeTrailer": {
         "numberOfFunctionalGroups": "1",
         "controlNumber": "000000001"
       }
     },
     "transactionSets": [
       {
         "heading": {
           "transaction_set_header_ST": {
             "transaction_set_identifier_code_01": "210",
             "transaction_set_control_number_02": 1
           },
           "beginning_segment_for_carriers_invoice_B3": {
             "invoice_number_02": "PRONUMBER",
             "shipment_identification_number_03": "Shipment ID Number",
             "shipment_method_of_payment_04": "PP",
             "date_06": "2004-08-05",
             "net_amount_due_07": 274.09,
             "delivery_date_09": "2004-08-09",
             "date_time_qualifier_10": "017",
             "standard_carrier_alpha_code_11": "CNWY"
           },
           "reference_identification_N9": [
             {
               "reference_identification_qualifier_01": "PO",
               "reference_identification_02": "Reference Identification"
             }
           ],
           "name_N1_loop_Shipper": [
             {
               "name_N1": {
                 "entity_identifier_code_01": "SH",
                 "name_02": "Name"
               },
               "additional_name_information_N2": {
                 "name_01": "Name"
               },
               "address_information_N3": [
                 {
                   "address_information_01": "Address Information"
                 }
               ],
               "geographic_location_N4": {
                 "city_name_01": "City Name",
                 "state_or_province_code_02": "St",
                 "postal_code_03": "Postal Code",
                 "country_code_04": "USA"
               }
             }
           ],
           "name_N1_loop_consignee": [
             {
               "name_N1": {
                 "entity_identifier_code_01": "CN",
                 "name_02": "Name"
               },
               "additional_name_information_N2": {
                 "name_01": "Name"
               },
               "address_information_N3": [
                 {
                   "address_information_01": "Address Information"
                 }
               ],
               "geographic_location_N4": {
                 "city_name_01": "City Name",
                 "state_or_province_code_02": "St",
                 "postal_code_03": "Postal Code",
                 "country_code_04": "USA"
               }
             }
           ],
           "name_N1_loop_bill_to": [
             {
               "name_N1": {
                 "entity_identifier_code_01": "BT",
                 "name_02": "Name"
               },
               "additional_name_information_N2": {
                 "name_01": "Name"
               },
               "address_information_N3": [
                 {
                   "address_information_01": "Address Information"
                 }
               ],
               "geographic_location_N4": {
                 "city_name_01": "City Name",
                 "state_or_province_code_02": "St",
                 "postal_code_03": "Postal Code",
                 "country_code_04": "USA"
               }
             }
           ]
         },
         "detail": {
           "assigned_number_LX_loop": [
             {
               "assigned_number_LX": {
                 "assigned_number_01": 1
               },
               "description_marks_and_numbers_L5": [
                 {
                   "lading_line_item_number_01": 1,
                   "lading_description_02": "Lading Description"
                 },
                 {
                   "lading_line_item_number_01": 1,
                   "lading_description_02": "Lading Description continued"
                 }
               ],
               "line_item_quantity_and_weight_L0": [
                 {
                   "lading_line_item_number_01": 1,
                   "weight_04": 2442,
                   "weight_qualifier_05": "G",
                   "lading_quantity_08": 509,
                   "packaging_form_code_09": "BDL",
                   "weight_unit_code_11": "L"
                 }
               ],
               "rate_and_charges_L1": [
                 {
                   "lading_line_item_number_01": 1,
                   "freight_rate_02": 325.41,
                   "rate_value_qualifier_03": "FR",
                   "charge_04": 325.41
                 }
               ],
               "tariff_reference_L7": [
                 {
                   "lading_line_item_number_01": 1,
                   "tariff_agency_code_02": "CNWY",
                   "tariff_number_03": "5350",
                   "freight_class_code_07": "55"
                 }
               ]
             },
             {
               "assigned_number_LX": {
                 "assigned_number_01": 2
               },
               "description_marks_and_numbers_L5": [
                 {
                   "lading_line_item_number_01": 2,
                   "lading_description_02": "XPO DISCOUNT SAVES YOU"
                 }
               ],
               "rate_and_charges_L1": [
                 {
                   "lading_line_item_number_01": 2,
                   "charge_04": -40.23,
                   "special_charge_or_allowance_code_08": "DSC"
                 }
               ],
               "tariff_reference_L7": [
                 {
                   "lading_line_item_number_01": 2,
                   "tariff_agency_code_02": "CNWY",
                   "tariff_number_03": "5350"
                 }
               ]
             },
             {
               "assigned_number_LX": {
                 "assigned_number_01": 3
               },
               "description_marks_and_numbers_L5": [
                 {
                   "lading_line_item_number_01": 3,
                   "lading_description_02": "FSC FUEL SURCHARGE 8.30% ...."
                 }
               ],
               "rate_and_charges_L1": [
                 {
                   "lading_line_item_number_01": 3,
                   "freight_rate_02": 30.82,
                   "rate_value_qualifier_03": "FR",
                   "charge_04": 30.82,
                   "special_charge_or_allowance_code_08": "FUE"
                 }
               ],
               "tariff_reference_L7": [
                 {
                   "lading_line_item_number_01": 3,
                   "tariff_agency_code_02": "CNWY",
                   "tariff_number_03": "110"
                 }
               ]
             }
           ]
         },
         "summary": {
           "total_weight_and_charges_L3": {
             "weight_01": 2442,
             "weight_qualifier_02": "G",
             "freight_rate_03": 10484,
             "rate_value_qualifier_04": "MN",
             "charge_05": 274.09,
             "lading_quantity_11": 509,
             "weight_unit_code_12": "L"
           },
           "transaction_set_trailer_SE": {
             "number_of_included_segments_01": 13,
             "transaction_set_control_number_02": 1
           }
         }
       }
     ]
   }
   ```
</details>

### Outbound EDI

The `outbound-edi` function can be invoked via the UI for testing. 

1. Navigate to the `outbound-edi` function in the [Functions UI](https://www.stedi.com/terminal/functions/edi-outbound/edit).

2. Click the `Edit execution payload` link, paste the contents of [src/resources/X12/5010/850/outbound.json](src/resources/X12/5010/850/outbound.json) into the payload modal, and click save.

3. Hit the `Execute` button, if successful the `Output` should look similar to the following:
  
  <details><summary>Example function output (click to expand):</summary>

   ```json
   { 
      "statusCode": 200,
      "deliveryResults": [
        {
          "type": "bucket",
          "payload": {
            "bucketName": "4c22f54a-9ecf-41c8-b404-6a1f20674953-sftp",
            "key": "trading_partners/ANOTHERMERCH/outbound/000000005-850.edi",
            "body": "ISA*00*          *00*          *ZZ*THISISME       *14*ANOTHERMERCH   *230113*2027*U*00501*000000005*0*T*>~GS*PO*MYAPPID*ANOTAPPID*20230113*202727*000000005*X*005010~ST*850*0001~BEG*00*DS*365465413**20220830~REF*CO*ACME-4567~REF*ZZ*Thank you for your business~PER*OC*Marvin Acme*TE*973-555-1212*EM*marvin@acme.com~TD5****ZZ*FHD~N1*ST*Wile E Coyote*92*123~N3*111 Canyon Court~N4*Phoenix*AZ*85001*US~PO1*item-1*0008*EA*400**VC*VND1234567*SK*ACM/8900-400~PID*F****400 pound anvil~PO1*item-2*0004*EA*125**VC*VND000111222*SK*ACM/1100-001~PID*F****Detonator~CTT*2~AMT*TT*3700~SE*16*0001~GE*1*000000005~IEA*1*000000005~"
          }
        }
      ]
   }
   ```

  </details>

5. You can view the file using the [Buckets Web View](https://www.stedi.com/app/buckets). As shown above, the output of the function includes the `bucketName` and `key` (path within the bucket) of where the generated EDI was saved.
