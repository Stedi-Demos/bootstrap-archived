/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import jszpl from "jszpl";
import fetch from "node-fetch";
import { bucketsClient } from "../../../lib/clients/buckets.js";
import { PutObjectCommand } from "@stedi/sdk-client-buckets";
import { stashClient } from "../../../lib/clients/stash.js";
import { IncrementValueCommand } from "@stedi/sdk-client-stash";
import { gs1CheckDigit } from "./gsiCheckDigit.js";

const buckets = bucketsClient();
const stash = stashClient();

const {
  Label,
  Box,
  Spacing,
  PrintDensity,
  PrintDensityName,
  Barcode,
  BarcodeType,
  BarcodeTypeName,
  Text,
  FontFamily,
  FontFamilyName,
} = jszpl;

const labelJSONSample = {
  shipFrom: {
    line1: "Happy Publisher",
    line2: "1234 Main St",
    city: "Anytown",
    state: "MD",
    zipCode: "2814",
  },
  shipTo: {
    line1: "Buckle Inc.",
    line2: "2915 W 16th Street",
    city: "Kearney",
    state: "NE",
    zipCode: "68845",
  },
  carrier: {
    name: "United Parcel Service",
    bol: "123456789",
  },
  purchseOrder: {
    number: "123456789",
    quantity: 1,
    cartons: {
      style: "T-Shirt",
      color: "red",
      size: "XL",
    },
  },
  gs1: {
    companyPrefix: "884794",
  },
};

const baseText = (str: string): typeof Text => {
  const text = new Text();
  text.text = str;
  text.fontFamily = new FontFamily(FontFamilyName.A);
  text.characterHeight = 20;

  text.lineSpacing = 16;
  return text;
};

const headerText = (str: string): typeof Text => {
  const text = new Text();
  text.text = str;
  text.fontFamily = new FontFamily(FontFamilyName.B);
  text.characterHeight = 24;
  return text;
};

export const handler = async (labelJSON: typeof labelJSONSample) => {
  // Label at 8 dpmm
  // Height: 148 mm = 1184 dots [6 in[]
  // Width: 105 mm  = 840 dots  [4 in]

  const { value: serialNumber } = await stash.send(
    new IncrementValueCommand({
      keyspaceName: "gs1-serial-numbers",
      key: labelJSON.gs1.companyPrefix,
      amount: 1,
    })
  );
  if (serialNumber === undefined || typeof serialNumber !== "number")
    throw new Error("Stash failed to generate a valid serial number");

  const paddedSerialNumber = serialNumber
    .toString()
    .padStart(16 - labelJSON.gs1.companyPrefix.length, "0");
  console.log(paddedSerialNumber);

  let gs1 = `${labelJSON.gs1.companyPrefix}${paddedSerialNumber}`;

  const checkDigit = gs1CheckDigit(gs1);

  if (checkDigit === null)
    throw new Error("GS1 check digit failed to generate");

  gs1 = `(00)0${gs1}${checkDigit}`;

  const label = new Label();
  label.printDensity = new PrintDensity(PrintDensityName["8dpmm"]);
  label.width = 100;
  label.padding = new Spacing(20);

  // ROW 1
  const row1 = new Box();
  row1.height = 225;
  label.content.push(row1);

  const shipFrom = new Box();
  shipFrom.width = 460;
  row1.content.push(shipFrom);

  const shipFromHeader = headerText("FROM:");
  shipFrom.content.push(shipFromHeader);

  const shipFromLines = [];
  if (labelJSON.shipFrom.line1) shipFromLines.push(labelJSON.shipFrom.line1);
  if (labelJSON.shipFrom.line2) shipFromLines.push(labelJSON.shipFrom.line2);

  const shipFromAddress = baseText(
    `${shipFromLines.join("\n")}\n${labelJSON.shipFrom.city}, ${
      labelJSON.shipFrom.state
    } ${labelJSON.shipFrom.zipCode}`
  );
  shipFrom.content.push(shipFromAddress);
  shipFromAddress.top = 40;

  const shipTo = new Box();
  shipTo.left = 480;
  row1.content.push(shipTo);

  const shipToHeader = headerText("TO:");
  shipTo.content.push(shipToHeader);

  const shipToLines = [];
  if (labelJSON.shipTo.line1) shipToLines.push(labelJSON.shipTo.line1);
  if (labelJSON.shipTo.line2) shipToLines.push(labelJSON.shipTo.line2);

  const shipToAddress = baseText(
    `${shipToLines.join("\n")}\n${labelJSON.shipTo.city}, ${
      labelJSON.shipTo.state
    } ${labelJSON.shipTo.zipCode}`
  );
  shipToAddress.top = 40;
  shipTo.content.push(shipToAddress);

  const hr1 = new Box();
  row1.content.push(hr1);
  hr1.top = 220;
  hr1.height = 5;
  hr1.fill = true;

  const row1VR = new Box();
  row1.content.push(row1VR);
  row1VR.top = 0;
  row1VR.left = 460;
  row1VR.height = 225;
  row1VR.width = 4;
  row1VR.fill = true;

  // ROW 2
  const row2 = new Box();
  row2.fill = true;
  row1.height = 225;
  row2.top = 225;
  label.content.push(row2);

  const markForPartyBox = new Box();
  markForPartyBox.width = 400;
  markForPartyBox.height = 220;
  row2.content.push(markForPartyBox);

  const markForParty = baseText("SHIP TO POSTAL CODE:");
  markForParty.top = 20;
  markForPartyBox.content.push(markForParty);

  const shipToZip = headerText(`(420) ${labelJSON.shipTo.zipCode}`);
  shipToZip.top = 55;
  shipToZip.left = 50;
  markForPartyBox.content.push(shipToZip);

  const shipToZipBarcode = new Barcode();
  shipToZipBarcode.top = 100;
  shipToZipBarcode.left = 20;
  shipToZipBarcode.height = 100;
  shipToZipBarcode.type = new BarcodeType(BarcodeTypeName.Code128);
  shipToZipBarcode.data = `(420) ${labelJSON.shipTo.zipCode}`;
  shipToZipBarcode.interpretationLine = false;
  markForPartyBox.content.push(shipToZipBarcode);

  const row2VR = new Box();
  row2VR.top = 0;
  row2VR.left = 380;
  row2VR.height = 225;
  row2VR.width = 4;
  row2VR.fill = true;
  row2.content.push(row2VR);

  const carrierDetailsBox = new Box();
  carrierDetailsBox.left = 400;
  carrierDetailsBox.fill = true;

  const carrierHeader = headerText("CARRIER:");
  carrierHeader.top = 20;
  carrierDetailsBox.content.push(carrierHeader);
  const carrierName = baseText(labelJSON.carrier.name.toUpperCase());
  carrierName.top = 60;
  carrierDetailsBox.content.push(carrierName);

  const bolHeader = headerText("BOL#:");
  bolHeader.top = 150;
  carrierDetailsBox.content.push(bolHeader);
  const bol = baseText(labelJSON.carrier.bol.toUpperCase());
  bol.top = 190;
  carrierDetailsBox.content.push(bol);

  row2.content.push(carrierDetailsBox);

  const hr2 = new Box();
  row2.content.push(hr2);
  hr2.top = 220;
  hr2.height = 5;
  hr2.fill = true;

  // ROW 3
  const row3 = new Box();
  row3.top = 450;
  row3.height = 225;
  // row3.fill = true;
  label.content.push(row3);

  const row3LeftBox = new Box();
  row3LeftBox.width = 320;
  row3.content.push(row3LeftBox);

  const poNumber = headerText(`PO: ${labelJSON.purchseOrder.number}`);
  poNumber.top = 20;
  row3LeftBox.content.push(poNumber);

  const quantity = baseText(`QTY: ${labelJSON.purchseOrder.quantity}`);
  quantity.top = 140;
  row3LeftBox.content.push(quantity);

  const row3RightBox = new Box();
  row3RightBox.left = 340;
  row3.content.push(row3RightBox);

  const cartons = headerText("CARTONS:");
  cartons.top = 20;
  row3RightBox.content.push(cartons);

  const style = baseText(`STYLE: ${labelJSON.purchseOrder.cartons.style}`);
  style.top = 70;
  row3RightBox.content.push(style);

  const color = baseText(`COLOR: ${labelJSON.purchseOrder.cartons.color}`);
  color.top = 110;
  row3RightBox.content.push(color);

  const size = baseText(`SIZE: ${labelJSON.purchseOrder.cartons.size}`);
  size.top = 150;
  row3RightBox.content.push(size);

  // ROW 4
  const row4 = new Box();
  row4.top = 675;
  row4.height = 250;
  // row4.fill = true;
  label.content.push(row4);

  const row4LeftBox = new Box();
  row4LeftBox.width = 460;
  row4.content.push(row4LeftBox);

  const storeNumberLabel = baseText("STORE NUMBER:");
  storeNumberLabel.top = 20;
  row4LeftBox.content.push(storeNumberLabel);

  const storeNumberHeader = headerText("(91) 900");
  storeNumberHeader.top = 60;
  storeNumberHeader.left = 50;
  row4LeftBox.content.push(storeNumberHeader);

  const storeNumberBarcode = new Barcode();
  storeNumberBarcode.top = 100;
  storeNumberBarcode.left = 20;
  storeNumberBarcode.height = 100;
  storeNumberBarcode.type = new BarcodeType(BarcodeTypeName.Code128);
  storeNumberBarcode.data = `(91) 900`;
  storeNumberBarcode.interpretationLine = false;
  row4LeftBox.content.push(storeNumberBarcode);

  const row4VR = new Box();
  row4.content.push(row4VR);
  row4VR.top = 0;
  row4VR.left = 460;
  row4VR.height = 250;
  row4VR.width = 4;
  row4VR.fill = true;

  const row4RightBox = new Box();
  row4RightBox.left = 480;
  row4.content.push(row4RightBox);

  const forHeader = baseText("FOR:");
  forHeader.top = 20;
  row4RightBox.content.push(forHeader);

  const storeNumberText = headerText("DC 900");
  storeNumberText.top = 70;
  row4RightBox.content.push(storeNumberText);

  const storeAddress = baseText(
    `${shipToLines.join("\n")}\n${labelJSON.shipTo.city}, ${
      labelJSON.shipTo.state
    } ${labelJSON.shipTo.zipCode}`
  );
  storeAddress.top = 110;
  row4RightBox.content.push(storeAddress);

  const hr3 = new Box();
  row4.content.push(hr3);
  hr3.height = 5;
  hr3.fill = true;

  // ROW 5
  const row5 = new Box();
  row5.top = 925;
  row5.height = 225;
  label.content.push(row5);

  const serialShippingContainerHeader = headerText(gs1);
  serialShippingContainerHeader.top = 40;
  serialShippingContainerHeader.left = 180;
  row5.content.push(serialShippingContainerHeader);

  const serialShippingContainerBarcode = new Barcode();
  serialShippingContainerBarcode.top = 70;
  serialShippingContainerBarcode.left = 80;
  serialShippingContainerBarcode.height = 140;
  serialShippingContainerBarcode.type = new BarcodeType(
    BarcodeTypeName.Code128
  );
  serialShippingContainerBarcode.data = gs1;
  serialShippingContainerBarcode.interpretationLine = false;
  row5.content.push(serialShippingContainerBarcode);

  const hr4 = new Box();
  row5.content.push(hr4);
  hr4.height = 5;
  hr4.fill = true;

  const zpl: string = label.generateZPL();
  // console.log(zpl.replaceAll(" ", "%20"));

  const result = await fetch(
    "http://api.labelary.com/v1/printers/8dpmm/labels/4x6/0/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/pdf",
      },
      body: zpl,
    }
  );

  if (result.ok) {
    const blob = await result.blob();
    let buffer = await blob.arrayBuffer();
    buffer = Buffer.from(buffer);
    // fs.createWriteStream("./label.pdf").write(buffer);

    const zplPath = `gs1/${labelJSON.gs1.companyPrefix}/${paddedSerialNumber}.zpl`;
    const pdfPath = `gs1/${labelJSON.gs1.companyPrefix}/${paddedSerialNumber}.pdf`;
    await Promise.all([
      buckets.send(
        new PutObjectCommand({
          bucketName: "stord-labels-bdq",
          key: pdfPath,
          body: buffer,
        })
      ),
      buckets.send(
        new PutObjectCommand({
          bucketName: "stord-labels-bdq",
          key: zplPath,
          body: zpl,
        })
      ),
    ]);

    return {
      zplPath,
      pdfPath,
    };
  } else {
    console.error(result.statusText);
    return { error: "label failed to generate" };
  }
};
