const { test, expect, describe } = require("bun:test");
const { parseEml } = require("./parser.js");
const fs = require("fs");
const path = require("path");

const fixturesDir = path.join(__dirname, "fixtures");

function loadFixture(relPath) {
  return fs.readFileSync(path.join(fixturesDir, relPath));
}

function findFixture(name) {
  const keys = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".eml")) keys.push(path.relative(fixturesDir, p));
    }
  }
  walk(fixturesDir);
  return keys.find((k) => k.includes(name));
}

function getFixture(name) {
  return loadFixture(findFixture(name));
}

describe("EML Parser - all fixtures smoke tests", () => {
  const keys = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".eml")) keys.push(path.relative(fixturesDir, p));
    }
  }
  walk(fixturesDir);

  for (const key of keys) {
    test(`smoke: ${key}`, () => {
      const data = loadFixture(key);
      const parsed = parseEml(data);
      expect(parsed).toBeObject();
      expect(parsed.headers).toBeObject();
    });
  }
});

describe("EML Parser - structure tests", () => {
  test("example01.eml has correct subject and from", () => {
    const parsed = parseEml(getFixture("example01.eml"));
    expect(parsed.subject).toBe("Saying Hello");
    expect(parsed.from).toBe("John Doe <jdoe@machine.example>");
    expect(parsed.to.length).toBe(1);
    expect(parsed.to[0]).toInclude("mary@example.net");
  });

  test("example02.eml has sender", () => {
    const parsed = parseEml(getFixture("example02.eml"));
    expect(parsed.headers["sender"]).toBeTruthy();
  });

  test("attachments/basic_email.eml parses headers", () => {
    const parsed = parseEml(getFixture("attachments/basic_email.eml"));
    expect(parsed.subject).toBe("Testing 123");
    expect(parsed.from).toInclude("test@lindsaar.net");
  });

  test("plain_emails/basic_email.eml has body", () => {
    const parsed = parseEml(getFixture("plain_emails/basic_email.eml"));
    expect(parsed.textBody).toBeTruthy();
    expect(parsed.textBody).toInclude("Plain email");
  });

  test("raw_email2.eml is multipart with attachments", () => {
    const parsed = parseEml(getFixture("raw_email2.eml"));
    expect(parsed.parts.length).toBeGreaterThan(0);
    expect(parsed.attachments.length).toBeGreaterThan(0);
  });

  test("attachment_pdf.eml has PDF attachment", () => {
    const parsed = parseEml(getFixture("attachment_pdf.eml"));
    expect(parsed.attachments.length).toBeGreaterThan(0);
    expect(parsed.attachments.some((a) => a.contentType.type === "application/pdf")).toBe(true);
  });

  test("japanese.eml handles Japanese subject", () => {
    const parsed = parseEml(getFixture("japanese.eml"));
    expect(parsed.subject).toBeTruthy();
    expect(parsed.subject.length).toBeGreaterThan(0);
  });

  test("utf8_headers.eml has UTF-8 headers", () => {
    const parsed = parseEml(getFixture("utf8_headers.eml"));
    expect(parsed.subject).toBeTruthy();
  });

  test("missing_body.eml parses without body", () => {
    const parsed = parseEml(getFixture("missing_body.eml"));
    expect(parsed.textBody).toBe("");
  });

  test("bad_date_header.eml still parses", () => {
    const parsed = parseEml(getFixture("bad_date_header.eml"));
    expect(parsed.headers).toBeObject();
  });

  test("raw_email_simple.eml has from and to", () => {
    const parsed = parseEml(getFixture("raw_email_simple.eml"));
    expect(parsed.from).toBeTruthy();
    expect(parsed.to.length).toBeGreaterThan(0);
  });

  test("sig_only_email.eml parses", () => {
    const parsed = parseEml(getFixture("sig_only_email.eml"));
    expect(parsed.headers).toBeObject();
  });

  test("email_with_similar_boundaries.eml handles similar boundaries", () => {
    const parsed = parseEml(getFixture("email_with_similar_boundaries.eml"));
    expect(parsed.parts.length).toBeGreaterThanOrEqual(2);
  });

  test("raw_email_with_nested_attachment.eml has nested parts", () => {
    const parsed = parseEml(getFixture("raw_email_with_nested_attachment.eml"));
    expect(parsed.attachments.length).toBeGreaterThan(0);
  });

  test("attachment_message_rfc822.eml has message/rfc822", () => {
    const parsed = parseEml(getFixture("attachment_message_rfc822.eml"));
    expect(parsed.attachments.length > 0 || parsed.parts.length > 0).toBe(true);
  });

  test("report_422.eml is multipart report", () => {
    const parsed = parseEml(getFixture("report_422.eml"));
    expect(parsed.parts.length).toBeGreaterThan(0);
  });

  test("encoding_madness.eml parses", () => {
    const parsed = parseEml(getFixture("encoding_madness.eml"));
    expect(parsed.headers).toBeObject();
  });

  test("mix_caps_content_type.eml handles mixed case Content-Type", () => {
    const parsed = parseEml(getFixture("mix_caps_content_type.eml"));
    expect(parsed.textBody || parsed.htmlBody).toBeTruthy();
  });

  test("japanese_shift_jis.eml handles shift_jis", () => {
    const parsed = parseEml(getFixture("japanese_shift_jis.eml"));
    expect(parsed.subject).toBeTruthy();
  });

  test("raw_email_with_binary_encoded.eml handles binary encoding", () => {
    const parsed = parseEml(getFixture("raw_email_with_binary_encoded.eml"));
    expect(parsed.headers).toBeObject();
  });

  test("two_from_in_message.eml handles two from headers", () => {
    const parsed = parseEml(getFixture("two_from_in_message.eml"));
    expect(parsed.from).toBeTruthy();
  });
});
