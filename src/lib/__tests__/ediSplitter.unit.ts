import test from "ava";
import { splitEdi } from "../ediSplitter.js";

const isa =
  "ISA*00*          *00*          *12*7147085121     *01*040132628      *220921*1002*U*00501*000028538*0*P*>~";
const gs = "GS*PR*7147085121*040132628*20220921*1002*28538*X*005010~";
const gs2 = "GS*FA*009599671*040132628*20220926*0946*7540*X*005010~";
const ge = "GE*8*28538~";
const st855 = "ST*855*0001~";
const st997 = "ST*997*11445";
const body = "BAK*00*AK*4179213*20220920~";
const se = "SE*11*0001~";
const iea = "IEA*1*000028538~";

test("should throw error if non edi file", (t) => {
  const edi = "THIS IS NOT EDI";
  const error = t.throws(
    () => {
      splitEdi(edi);
    },
    { instanceOf: Error }
  );
  t.is(error?.message, "invalid ISA segment");
});

test("should throw error if isa envelope is too short", (t) => {
  const edi = isa.slice(0, 100);
  const error = t.throws(
    () => {
      splitEdi(edi);
    },
    { instanceOf: Error }
  );
  t.is(error?.message, "invalid ISA segment");
});

// EDI Translate only supports one GS per document
test("should throw error if interchange contains multiple functional groups", (t) => {
  const edi =
    isa + gs + st855 + body + se + ge + gs2 + st855 + body + se + ge + iea;
  const error = t.throws(
    () => {
      splitEdi(edi);
    },
    { instanceOf: Error }
  );
  t.is(error?.message, "only one functional group is allowed per interchange");
});

// EDI Translate requires all transaction sets within a functional group to be the same type
test("should throw error when functional group has multiple transactions of different types", (t) => {
  const edi = isa + gs + st855 + body + se + st997 + body + se + ge + iea;
  const error = t.throws(
    () => {
      splitEdi(edi);
    },
    { instanceOf: Error }
  );
  t.is(error?.message, "all transaction sets within a functional group must be the same type");
});

test("should generate a single split when edi file has a single transaction code", (t) => {
  const edi = isa + gs + st855 + body + se + ge + iea;
  const splitEdis = splitEdi(edi);
  t.is(splitEdis.length, 1);
  t.is(splitEdis[0].metadata.code, "855");
  t.is(splitEdis[0].edi, edi);
});

test("st element should not be parsed as header", (t) => {
  const edi =
    "ISA*00*          *00*          *ZZ*FEDEX          *ZZ*REALTRUCK      *220929*0431*U*00401*000032559*0*P*^~GS*QM*FEDEX*REALTRUCK*20220929*0431*32559*X*004010~ST*214*325590001~B10*770012873772*4310055*FDEG**33*O~L11*CM 941665*PO~K1*137~N1*SF*John Doe*25*673731465~N2*John Doe~N3*175 Kirkland Road~N4*MIAMI*FL*33142*US~G62*11*20220926~N1*ST*Luverne Truck Equipment~N2*ATTN  Returns Department~N3*1200 E BIRCH ST~N4*BRANDON*SD*57005*US~LX*1~AT7*AG*NS***20220929*0000~LX*2~AT7*X6*NS***20220929*0355*20~MS1*ADRIAN*MN*US~L11*4310055*CR~L11*LUV-481032*DP~K1*IT~AT8*G*L*27*1~SE*23*325590001~GE*237*32559~IEA*1*000032559~";

  const splitEdis = splitEdi(edi);
  t.is(splitEdis.length, 1);
  t.is(splitEdis[0].metadata.code, "214");
  t.is(edi, splitEdis[0].edi);
});

test("ensure all segments are present after split", (t) => {
  const edi =
    "ISA*00*          *00*          *01*040132628      *12*9702636910     *220930*1339*U*00501*000001868*0*P*>~GS*PO*040132628*9702636910*20220930*1339*000001868*X*005010~ST*850*0001~BEG*00*DS*4185107**20220930~PER*OC*XXXXX XXXXXXXXX*TE*(999) 999-9999~SAC*C*H750~TD5****ZZ*FHD~N1*ST*XXXXX XXXXXXXXX*92*DROPSHIP CUSTOMER~N3*9999 XXXXX XX~N4*Zephyrhills*FL*33541*US~PO1*1*1.00*EA*28.68**VC*W5614SE*SK*WCA-W5614SE~PID*F****14MMX1.5 SPLINE ET 6-LUG KIT~CTT*1~AMT*TT*28.68~SE*13*0001~GE*1*000001868~IEA*1*000001868~";
  const splitEdis = splitEdi(edi);

  t.is(splitEdis.length, 1);
  t.is(splitEdis[0].metadata.code, "850");
  t.is(edi, splitEdis[0].edi);
});