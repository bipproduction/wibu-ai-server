export const printLog =
  (debug: boolean) =>
  (message: string, ...args: any) => {
    if (debug) console.log("===> ",message, ...args);
  };
