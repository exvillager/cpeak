import assert from "node:assert";
import supertest from "supertest";
import { Cpeak } from "../lib/";
import type { CpeakRequest, CpeakResponse } from "../lib/types";

const PORT = 7550;
const r = supertest(`http://localhost:${PORT}`);

describe("Subrouter", function () {
  let app: Cpeak;

  before(function (done) {
    app = new Cpeak();

    const users = new Cpeak();
    users.route("get", "/", (req: CpeakRequest, res: CpeakResponse) =>
      res.json({ r: "root" })
    );
    users.route("get", "/:id", (req: CpeakRequest, res: CpeakResponse) =>
      res.json({ id: req.params.id })
    );

    const exact = new Cpeak();
    exact.route("get", "/", (req: CpeakRequest, res: CpeakResponse) =>
      res.json({ r: "exact" })
    );

    app.subroute("/api/users/*", users);
    app.subroute("/api/v2", exact);

    app.listen(PORT, done);
  });

  after(function (done) {
    app.close(done);
  });

  it("routes to subrouter root", async () => {
    const res = await r.get("/api/users/");
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, { r: "root" });
  });

  it("strips prefix and matches :id param", async () => {
    const res = await r.get("/api/users/42");
    assert.deepStrictEqual(res.body, { id: "42" });
  });

  it("exact prefix (no /*) matches only the exact path", async () => {
    assert.strictEqual((await r.get("/api/v2")).status, 200);
    assert.strictEqual((await r.get("/api/v2/items")).status, 404);
  });
});

describe("Subroute Middl test", () => {
  let app: Cpeak;
  let count = 0;
  const r2 = supertest(`http://localhost:${PORT + 1}`);

  before((done) => {
    app = new Cpeak();

    app.beforeEach((req, res, next) => {
      count++;
      next();
    });
    app.route("get", "/", (_, res) => res.end("/"));

    const userRoute = new Cpeak();
    userRoute.beforeEach((req, res, next) => {
      count++;
      next();
    });
    userRoute.route("get", "/", (_, res) => res.end("/user"));

    app.subroute("/user/*", userRoute);
    app.listen(PORT + 1, done);
  });

  after((done) => {
    app.close(done);
  });

  it("global middleware runs but subrouter middleware doesn't for parent routes", async () => {
    count = 0;
    await r2.get("/");
    assert.strictEqual(count, 1);
  });

  it("both global and subrouter middleware run for subrouted paths", async () => {
    count = 0;
    await r2.get("/user/");
    assert.strictEqual(count, 2);
  });
});
