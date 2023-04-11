/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import jszpl from "jszpl";
const {
  Alignment,
  AlignmentValue,
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
  text.fontFamily = new FontFamily(FontFamilyName.D);
  text.characterHeight = 16;
  return text;
};

(() => {
  // Label at 8 dpmm
  // Height: 148 mm = 1184 dots [6 in[]
  // Width: 105 mm  = 840 dots  [4 in]

  const label = new Label();
  label.printDensity = new PrintDensity(PrintDensityName["8dpmm"]);
  label.width = 100;
  label.padding = new Spacing(20);

  // ROW 1
  const row1 = new Box();
  row1.height = 225;
  label.content.push(row1);

  const shipFrom = new Box();
  shipFrom.width = 400;
  row1.content.push(shipFrom);

  const shipFromHeader = headerText("SHIP FROM:");
  shipFrom.content.push(shipFromHeader);

  const shipFromAddress = baseText(
    "Happy Publisher\n1234 Main St\nAnytown\nUSA 12345"
  );
  shipFrom.content.push(shipFromAddress);
  shipFromAddress.top = 30;

  const shipTo = new Box();
  shipTo.left = 400;
  row1.content.push(shipTo);

  const shipToHeader = headerText("SHIP TO:");
  shipTo.content.push(shipToHeader);

  const shipToAddress = baseText(
    "Amazon.com\n1234 Some St\nThe Town\nUSA 1421"
  );
  shipToAddress.top = 30;
  shipTo.content.push(shipToAddress);

  const hr1 = new Box();
  row1.content.push(hr1);
  hr1.top = 220;
  hr1.height = 5;
  hr1.fill = true;

  const vr1 = new Box();
  row1.content.push(vr1);
  vr1.top = 0;
  vr1.left = 380;
  vr1.height = 450;
  vr1.width = 4;
  vr1.fill = true;

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

  const markForParty = baseText("MARK FOR PARTY:");
  markForParty.top = 20;
  markForPartyBox.content.push(markForParty);

  const barcode = new Barcode();
  barcode.top = 50;
  barcode.left = 20;
  barcode.height = 100;
  barcode.type = new BarcodeType(BarcodeTypeName.Code128);
  barcode.data = "(420) 12345";
  markForPartyBox.content.push(barcode);

  const carrierDetailsBox = new Box();
  carrierDetailsBox.left = 400;
  carrierDetailsBox.fill = true;

  const carrierDetails = baseText(
    "CARRIER: Carrier 123\nB/L: BL123\nPRO: PRO123\n\nNUM CARTONS: 1"
  );
  carrierDetails.top = 20;
  carrierDetailsBox.content.push(carrierDetails);

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

  const contentBox1 = new Box();
  contentBox1.width = 380;
  const content1 = baseText(
    "CONTENT\nPO #: PO123456\nItem #: 123456789\n\nITEM DESC: Big Fishes Little Fishes\n\nCARTON QTY: 1"
  );
  content1.top = 20;
  contentBox1.content.push(content1);
  row3.content.push(contentBox1);

  const contentBox2 = new Box();
  contentBox2.left = 400;

  const content2 = baseText("\nSKU: SK321312\n\nUPC: 12345678901");
  content2.top = 20;
  contentBox2.content.push(content2);
  row3.content.push(contentBox2);

  // ROW 4
  const row4 = new Box();
  row4.top = 675;
  row4.height = 250;
  // row4.fill = true;
  label.content.push(row4);

  const hr3 = new Box();
  row4.content.push(hr3);
  hr3.height = 5;
  hr3.fill = true;

  const vr2 = new Box();
  row4.content.push(vr2);
  vr2.top = 0;
  vr2.left = 380;
  vr2.height = 250;
  vr2.width = 4;
  vr2.fill = true;

  // ROW 5
  const row5 = new Box();
  row5.top = 925;
  row5.height = 225;
  label.content.push(row5);

  const serialShippingContainerHeader = headerText(
    "SERIAL SHIPPING CONTAINER NUMBER"
  );
  serialShippingContainerHeader.top = 40;
  serialShippingContainerHeader.left = 200;
  row5.content.push(serialShippingContainerHeader);

  const serialShippingContainerBarcode = new Barcode();
  serialShippingContainerBarcode.top = 70;
  serialShippingContainerBarcode.left = 80;
  serialShippingContainerBarcode.height = 100;
  serialShippingContainerBarcode.type = new BarcodeType(
    BarcodeTypeName.Code128
  );
  serialShippingContainerBarcode.data = "(00)001232313123442334232";
  row5.content.push(serialShippingContainerBarcode);

  const hr4 = new Box();
  row5.content.push(hr4);
  hr4.height = 5;
  hr4.fill = true;

  const zpl = label.generateZPL();
  console.log(zpl);
})();
