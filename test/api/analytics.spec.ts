import { assert } from "chai";
import { suite, test } from "mocha";
import { Chain } from "../../src";
import { ActivityEventType } from "../../src/api/types";
import { api, BAYC_CONTRACT_ADDRESS } from "../utils/constants";

suite("Analytics API", () => {
  test("Get activity events", async () => {
    const response = await api.getActivity(
      undefined,
      [ActivityEventType.SALE, ActivityEventType.TRANSFER],
      10,
    );
    assert.exists(response);
    assert.isArray(response.asset_events);
    assert.isAtMost(response.asset_events.length, 10);
  });

  test("Get events by collection", async () => {
    const response = await api.getEventsByCollection(
      "doodles-official",
      [ActivityEventType.SALE],
      5,
    );
    assert.exists(response);
    assert.isArray(response.asset_events);
    assert.isAtMost(response.asset_events.length, 5);

    if (response.asset_events.length > 0) {
      const event = response.asset_events[0];
      assert.exists(event.event_type);
      assert.exists(event.event_timestamp);
    }
  });

  test("Get events by NFT", async () => {
    const response = await api.getEventsByNFT(
      BAYC_CONTRACT_ADDRESS,
      "1",
      Chain.Mainnet,
      undefined,
      10,
    );
    assert.exists(response);
    assert.isArray(response.asset_events);
    assert.isAtMost(response.asset_events.length, 10);

    if (response.asset_events.length > 0) {
      const event = response.asset_events[0];
      assert.exists(event.event_type);
      assert.exists(event.event_timestamp);
      assert.exists(event.nft);
      assert.equal(event.nft?.identifier, "1");
    }
  });

  test("Get events by account", async () => {
    // Using a known active account address
    const accountAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; // vitalik.eth
    const response = await api.getEventsByAccount(
      accountAddress,
      Chain.Mainnet,
      undefined,
      5,
    );
    assert.exists(response);
    assert.isArray(response.asset_events);
    assert.isAtMost(response.asset_events.length, 5);
  });

  test("Get events with time filters", async () => {
    const now = Math.floor(Date.now() / 1000);
    const oneHourAgo = now - 3600;

    const response = await api.getEventsByCollection(
      "doodles-official",
      undefined,
      10,
      undefined,
      oneHourAgo,
      now,
    );
    assert.exists(response);
    assert.isArray(response.asset_events);

    // Check that all events are within the time range
    response.asset_events.forEach((event) => {
      assert.isAtLeast(event.event_timestamp, oneHourAgo);
      assert.isAtMost(event.event_timestamp, now);
    });
  });

  test("Get events with pagination", async () => {
    const firstPage = await api.getEventsByCollection(
      "doodles-official",
      undefined,
      2,
    );
    assert.exists(firstPage);
    assert.isArray(firstPage.asset_events);

    if (firstPage.next) {
      const secondPage = await api.getEventsByCollection(
        "doodles-official",
        undefined,
        2,
        firstPage.next,
      );
      assert.exists(secondPage);
      assert.isArray(secondPage.asset_events);

      // Ensure the pages have different events
      if (
        firstPage.asset_events.length > 0 &&
        secondPage.asset_events.length > 0
      ) {
        assert.notEqual(
          firstPage.asset_events[0].event_timestamp,
          secondPage.asset_events[0].event_timestamp,
        );
      }
    }
  });
});
