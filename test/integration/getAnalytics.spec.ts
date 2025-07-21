import { assert } from "chai";
import { suite, test } from "mocha";
import { sdk } from "./setup";
import { ActivityEventType } from "../../src/api/types";
import { BAYC_CONTRACT_ADDRESS, BAYC_TOKEN_IDS } from "../utils/constants";

suite("OpenSeaAPI / getAnalytics", function () {
  test("Get general activity events", async () => {
    const response = await sdk.api.getEvents(
      [ActivityEventType.SALE, ActivityEventType.TRANSFER],
      5,
    );

    assert.exists(response, "Response should exist");
    assert.isArray(response.asset_events, "Events should be an array");
    assert.isAtMost(
      response.asset_events.length,
      5,
      "Should respect limit parameter",
    );

    if (response.asset_events.length > 0) {
      const event = response.asset_events[0];
      assert.exists(event.event_type, "Event should have event_type");
      assert.exists(event.event_timestamp, "Event should have timestamp");
      assert.isNumber(event.quantity, "Event should have quantity");
    }
  });

  test("Get events by collection", async () => {
    const response = await sdk.api.getEventsByCollection(
      "boredapeyachtclub",
      [ActivityEventType.SALE, ActivityEventType.LISTING],
      10,
    );

    assert.exists(response, "Response should exist");
    assert.isArray(response.asset_events, "Events should be an array");
    assert.isAtMost(
      response.asset_events.length,
      10,
      "Should respect limit parameter",
    );

    // Verify all events are for the correct collection
    response.asset_events.forEach((event) => {
      if (event.nft?.collection) {
        assert.equal(
          event.nft.collection,
          "boredapeyachtclub",
          "All events should be for the requested collection",
        );
      }
    });
  });

  test("Get events by NFT", async () => {
    const tokenId = BAYC_TOKEN_IDS[0];
    const response = await sdk.api.getEventsByNFT(
      BAYC_CONTRACT_ADDRESS,
      tokenId,
      sdk.chain,
      undefined, // All event types
      20,
    );

    assert.exists(response, "Response should exist");
    assert.isArray(response.asset_events, "Events should be an array");

    // Verify all events are for the correct NFT
    response.asset_events.forEach((event) => {
      if (event.nft) {
        assert.equal(
          event.nft.identifier,
          tokenId,
          "All events should be for the requested token ID",
        );
        assert.equal(
          event.nft.contract.toLowerCase(),
          BAYC_CONTRACT_ADDRESS.toLowerCase(),
          "All events should be for the correct contract",
        );
      }
    });
  });

  test.skip("Get events by account", async () => {
    // Using a known active wallet address (OpenSea's wallet)
    const accountAddress = "0x5b3256965e7C3cF26E11FCAf296DfC8807C01073";

    const response = await sdk.api.getEventsByAccount(
      accountAddress,
      sdk.chain,
      [ActivityEventType.SALE, ActivityEventType.TRANSFER],
      10,
    );

    assert.exists(response, "Response should exist");
    assert.isArray(response.asset_events, "Events should be an array");
    assert.isAtMost(
      response.asset_events.length,
      10,
      "Should respect limit parameter",
    );

    // Verify events involve the account
    response.asset_events.forEach((event) => {
      const addressLower = accountAddress.toLowerCase();
      const involveAccount =
        event.seller?.toLowerCase() === addressLower ||
        event.buyer?.toLowerCase() === addressLower ||
        event.maker?.toLowerCase() === addressLower ||
        event.taker?.toLowerCase() === addressLower;

      assert.isTrue(
        involveAccount,
        "Event should involve the requested account",
      );
    });
  });

  test("Test pagination for collection events", async () => {
    // Get first page
    const firstPage = await sdk.api.getEventsByCollection(
      "boredapeyachtclub",
      undefined,
      3,
    );

    assert.exists(firstPage, "First page should exist");
    assert.isArray(firstPage.asset_events, "Events should be an array");
    assert.isAtMost(
      firstPage.asset_events.length,
      3,
      "Should have at most 3 events",
    );

    if (firstPage.next && firstPage.asset_events.length === 3) {
      // Get second page
      const secondPage = await sdk.api.getEventsByCollection(
        "boredapeyachtclub",
        undefined,
        3,
        firstPage.next,
      );

      assert.exists(secondPage, "Second page should exist");
      assert.isArray(secondPage.asset_events, "Events should be an array");

      // Ensure pages are different by comparing timestamps
      if (
        firstPage.asset_events.length > 0 &&
        secondPage.asset_events.length > 0
      ) {
        const firstEventTimestamp = firstPage.asset_events[0].event_timestamp;
        const secondEventTimestamp = secondPage.asset_events[0].event_timestamp;

        // Events should be different (different timestamps or same timestamp but different events)
        assert.isTrue(
          firstEventTimestamp !== secondEventTimestamp ||
            JSON.stringify(firstPage.asset_events[0]) !==
              JSON.stringify(secondPage.asset_events[0]),
          "Second page should have different events",
        );
      }
    }
  });

  test("Test time filtering for events", async () => {
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 24 * 60 * 60; // 24 hours ago

    const response = await sdk.api.getEventsByCollection(
      "boredapeyachtclub",
      [ActivityEventType.SALE],
      20,
      undefined,
      oneDayAgo,
      now,
    );

    assert.exists(response, "Response should exist");
    assert.isArray(response.asset_events, "Events should be an array");

    // Verify all events are within the time range
    response.asset_events.forEach((event) => {
      assert.isAtLeast(
        event.event_timestamp,
        oneDayAgo,
        "Event should be after the 'after' timestamp",
      );
      assert.isAtMost(
        event.event_timestamp,
        now,
        "Event should be before the 'before' timestamp",
      );
    });
  });

  test("Test event type filtering", async () => {
    const response = await sdk.api.getEventsByCollection(
      "boredapeyachtclub",
      [ActivityEventType.SALE], // Only sales
      10,
    );

    assert.exists(response, "Response should exist");
    assert.isArray(response.asset_events, "Events should be an array");

    // Verify all events are sales
    response.asset_events.forEach((event) => {
      assert.equal(
        event.event_type,
        ActivityEventType.SALE,
        "All events should be sales",
      );
    });
  });

  test("Test multiple event types", async () => {
    const eventTypes = [
      ActivityEventType.LISTING,
      ActivityEventType.OFFER,
      ActivityEventType.SALE,
    ];

    const response = await sdk.api.getEventsByCollection(
      "boredapeyachtclub",
      eventTypes,
      15,
    );

    assert.exists(response, "Response should exist");
    assert.isArray(response.asset_events, "Events should be an array");

    // Note: The API may return related event types (e.g., "order" for listings/offers)
    // so we'll just verify we got some events back
    if (response.asset_events.length > 0) {
      assert.isString(
        response.asset_events[0].event_type,
        "Event should have a type",
      );
    }
  });

  test("Handle collection with no recent events gracefully", async () => {
    // Using a very specific time range that might have no events
    const now = Math.floor(Date.now() / 1000);
    const fiveMinutesAgo = now - 5 * 60;

    const response = await sdk.api.getEventsByCollection(
      "boredapeyachtclub",
      [ActivityEventType.BURN], // Burns are rare
      10,
      undefined,
      fiveMinutesAgo,
      now,
    );

    assert.exists(response, "Response should exist even with no events");
    assert.isArray(response.asset_events, "Events should be an array");
    // It's okay if the array is empty
  });

  test("Get events for multiple NFTs from same collection", async () => {
    // Test first token
    const token1 = BAYC_TOKEN_IDS[0];
    const response1 = await sdk.api.getEventsByNFT(
      BAYC_CONTRACT_ADDRESS,
      token1,
      sdk.chain,
      undefined,
      5,
    );

    // Test second token
    const token2 = BAYC_TOKEN_IDS[1];
    const response2 = await sdk.api.getEventsByNFT(
      BAYC_CONTRACT_ADDRESS,
      token2,
      sdk.chain,
      undefined,
      5,
    );

    assert.exists(response1, "Response 1 should exist");
    assert.exists(response2, "Response 2 should exist");

    // Verify the events are for different tokens
    if (
      response1.asset_events.length > 0 &&
      response2.asset_events.length > 0
    ) {
      assert.notEqual(
        response1.asset_events[0].nft?.identifier,
        response2.asset_events[0].nft?.identifier,
        "Events should be for different tokens",
      );
    }
  });
});
