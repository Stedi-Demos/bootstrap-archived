export const gs1CheckDigit = (keyWoCD: string) => {
  /* Check that input string conveys number of digits that correspond to a given GS1 key */
  if (
    !/(^\d{7}$)|(^\d{11}$)|(^\d{12}$)|(^\d{13}$)|(^\d{16}$)|(^\d{17}$)/.test(
      keyWoCD
    )
  ) {
    return null;
  } else {
    /* Reverse string */
    keyWoCD = [...keyWoCD].reverse().join("");
    /* Alternatively fetch digits, multiply them by 3 or 1, and sum them up */
    let multipliedByThree = 0;
    let multipliedByOne = 0;
    for (let i = keyWoCD.length - 1; i >= 0; i--) {
      const char = keyWoCD[i];
      if (char === undefined) continue;

      if (parseInt(char) === 0) {
        continue;
      } else {
        if (i % 2 !== 0) {
          multipliedByOne += parseInt(char) * 1;
        } else {
          multipliedByThree += parseInt(char) * 3;
        }
      }
    }
    const sum = multipliedByThree + multipliedByOne;
    /* Subtract sum from nearest equal or higher multiple of ten */
    const checkDigit = Math.ceil(sum / 10) * 10 - sum;
    return checkDigit;
  }
};
