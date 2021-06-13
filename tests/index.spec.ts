import { dummy } from "../src";

describe("dummy", () => {
  it("is a dummy", () => {
    expect(dummy()).toEqual(1);
  });
});
