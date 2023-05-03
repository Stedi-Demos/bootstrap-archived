const defaultOutput = [
  {
    orderNumber: "12345",
    customerProject: "abcdef",
    date: "2023-04-18",
    memo: "well hello there",
    shipDate: "2024-04-18",
    shippingMethod: "carrier pigeon",
  },
  {
    orderNumber: "67890",
    customerProject: "ghijkl",
    date: "2023-04-30",
    memo: "ok bye then",
    shipDate: "2024-04-30",
    shippingMethod: "pony express",
  },
];

const customParserConfigOutput = [
  [
    "12345",
    "abcdef\n",
    "2023-04-18",
    "well hello there",
    "2024-04-18",
    "carrier pigeon",
  ],
  [
    "67890",
    "ghijkl\n",
    "2023-04-30",
    "ok bye then",
    "2024-04-30",
    "pony express",
  ],
];

export const defaultOutputAsString = JSON.stringify(defaultOutput);

export const customParserConfigOutputAsString = JSON.stringify(
  customParserConfigOutput
);
