# Judgements Admin API

How a Super Admin's PDF becomes a judgment record in Elasticsearch, and the eleven endpoints the admin dashboards use to write, read, search and report on that library. Only the routes wired into the live dashboards are documented here.

| | |
|---|---|
| Admin backend | `https://super-admin-backend-120280829617.asia-south1.run.app` |
| Mount | `/api/judgements-admin` |
| Store | Elasticsearch 8.19 · `ik_judgments` · `ik_judgment_paragraphs` |
| Updated | 2026-09-05, from the live code |

**Contents**

1. [How an uploaded judgment is stored](#1-how-an-uploaded-judgment-is-stored)
2. [What is written where](#2-what-is-written-where)
3. [Endpoints in use](#3-endpoints-in-use)
4. [Authentication](#4-authentication)
5. [Library endpoints](#5-library-endpoints)
6. [Pipeline report endpoints](#6-pipeline-report-endpoints)
7. [Search endpoints](#7-search-endpoints)
8. [Errors](#8-errors)
9. [Limits and configuration](#9-limits-and-configuration)

---

## 1. How an uploaded judgment is stored

One request carries one or more court PDFs. The service processes the files **one at a time, in order**, and answers only when every file is either searchable in the library or rejected with a reason. Every write goes to Elasticsearch; nothing is kept in Postgres, Cloud Storage or Qdrant, and the PDF itself is discarded once its text has been read.

| Step | Operation | Where | Detail |
|---:|---|---|---|
| 01 | **Request reaches the admin backend** | Backend `/api/judgements-admin/library/upload` | The bearer token is verified and the caller must hold the `super-admin` role. The multipart body is streamed unchanged to the judgement service, with the admin's id, role and email added as headers together with the internal service key. The proxy allows fifteen minutes for the whole batch. |
| 02 | **Judgement service authenticates and parses the files** | `routes/judgementRoutes.js` | The internal service key (or a Super Admin JWT) is checked, then multer reads the PDFs into memory. A request may carry up to 20 files of 60 MB each. A file that is not a PDF is recorded as `failed` and the batch continues. |
| 03 | **Index mapping is confirmed** | `elasticsearchService.ensureIkLibraryMapping` | Once per process, the `upload` bookkeeping object is mapped with `enabled: false` so it is stored with the record but never enters the inverted index. `PUT ik_judgments/_mapping` |
| 04 | **Text is extracted from the PDF** | `libraryUploadService.extractJudgmentText` | The PDF's own text layer is read first. If it yields at least 120 characters per page the file is treated as digital text (`text_source = pdf_text`). Otherwise the pages are split, sent to Google Document AI in batches of up to 15 pages, and stitched back in order (`text_source = ocr`). A file with no usable text either way is rejected with 422. OCR is skipped entirely when the form sends `allowOcr=0` or no Document AI processor is configured. |
| 05 | **The judgment gets its identifier** | `ikFormatService.deriveUploadTid` | The SHA-1 of the extracted text is reduced to ten digits and prefixed with `9`. This eleven-digit `tid` is both the record's id and its Elasticsearch document id. Indian Kanoon ids have at most nine digits, so the two ranges never collide. `tid = "9" + sha1(text) mod 10^10` |
| 06 | **Duplicate check** | `elasticsearchService.getIkJudgmentSource` | If a document with that tid already exists, the file is reported as `duplicate` with a summary of the existing record, and nothing is written. Because the tid is derived from the text, the same PDF always lands on the same id. `GET ik_judgments/_doc/{tid}` |
| 07 | **Case metadata is extracted** | `metadataService.extractMetadata` | Heuristics and Gemini read the text for the case name, court code and judgment date, and flag the record for review when they are unsure. This is the only model call on the path and runs only for new content. Outputs: `caseName`, `courtCode`, `judgmentDate`, `extractionMethod`, `needsReview`. |
| 08 | **The Indian Kanoon-format record is built** | `libraryUploadService.buildRecord` | The title comes from the admin's form or from the case name and date. The court is resolved from the form, then from the court code, then by scanning the text. Judges are taken from the form or detected from CORAM and signature lines. The text is laid out as Indian Kanoon HTML (`doc`), the searchable `text` is derived from that HTML exactly as the library does it, and the body is stamped with `fetched_at`, `source: "admin_upload"` and the `upload` block. The text is then chunked into paragraph rows tagged with sections, acts and citations. |
| 09 | **The judgment document is written** | `elasticsearchService.createIkJudgmentDocument` | A create-only write, so a record can never be overwritten by accident. A 409 from Elasticsearch means another request stored the same text first, and the file is reported as `duplicate`. `PUT ik_judgments/_create/{tid}` |
| 10 | **The paragraph rows are written** | `elasticsearchService.bulkCreateIkParagraphs` | All chunks go in one bulk request with ids `{tid}:1`, `{tid}:2` and so on. The call waits for the refresh, so the judgment is searchable by the time the response is sent. `POST _bulk (create) · refresh=wait_for` |
| 11 | **The response is assembled** | `libraryUploadController.uploadToLibrary` | Each file returns `indexed`, `duplicate` or `failed` with its own details and warnings. The status is 200 when at least one file was stored or found duplicate, and 422 when every file failed. |

### Editing and deleting follow the same rules

An edit (`PUT /library/{tid}`) recovers the body text from the stored HTML, rebuilds the record with the new title, court, date or judges, deletes the old documents and re-creates the judgment and its paragraphs under the same tid. A delete (`DELETE /library/{tid}`) removes the judgment document and runs a delete-by-query on the paragraph index. Both operations refuse any tid that does not start with `9`, so a real Indian Kanoon judgment can never be changed through this API.

---

## 2. What is written where

| Index | Document id | Content |
|---|---|---|
| `ik_judgments` | `{tid}` | One document per judgment in Indian Kanoon record format: `tid, title, doc, text, docsource, publishdate, author, bench, numcites, numcitedby, casesCited, citedBy`, plus `fetched_at`, `source: "admin_upload"` and the non-indexed `upload` block (filename, uploader, page count, text source, sha1, extraction method, review flag). |
| `ik_judgment_paragraphs` | `{tid}:{n}` | One row per chunk: `judgment_id, paragraph_no, text`, the parent's `title, docsource, publishdate, bench`, and `sections`, `acts`, `citations` found inside that chunk. |

**Who reads the result**

- **Admin Uploads tab** lists and opens records through the library endpoints.
- **User Pipeline tab** lists every judgment in `ik_judgments`; uploads appear with `sourceType: "admin-upload"`.
- **Judgement Search page** includes the library in its full-text leg and marks hits with `library: true`.
- **The Python library service** that owns the citation-research search reads the same two indexes without any change.

> The stored HTML in `doc` is the single source of truth. There is no second copy of the text and the PDF is not retained. To re-read a PDF, upload it again.

---

## 3. Endpoints in use

All routes are mounted on the admin backend under `/api/judgements-admin` and require a Super Admin bearer token. The backend forwards each call to the judgement service at the upstream path shown in every entry below.

| Method | Path | Purpose | Used by |
|---|---|---|---|
| `POST` | `/library/upload` | Store one or more PDFs in the library | Admin Uploads |
| `GET` | `/library` | List uploaded records, newest first | Admin Uploads |
| `GET` | `/library/{tid}` | One record with its text and paragraph count | Admin Uploads |
| `GET` | `/library/{tid}/html` | The stored HTML as a page or bare fragment | Admin Uploads · Judgement Search |
| `PUT` | `/library/{tid}` | Edit title, court, date or judges; record is rebuilt | Admin Uploads |
| `DELETE` | `/library/{tid}` | Remove the judgment and its paragraphs | Admin Uploads |
| `GET` | `/pipeline-report/summary` | Counts and date range for the library | User Pipeline |
| `GET` | `/pipeline-report` | Paged list of all library judgments | User Pipeline |
| `GET` | `/pipeline-report/{tid}` | One judgment with its text and HTML | User Pipeline |
| `POST` | `/search/hybrid` | Full-text and semantic search in one call | Judgement Search |
| `GET` | `/search/analytics` | Recent search requests and their timings | Judgement Search |

The search module also exposes `POST /search/full-text` and `POST /search/semantic`, which run the two legs of the hybrid call on their own with the same request body. The dashboards call only the hybrid form.

---

## 4. Authentication

| Hop | Credentials |
|---|---|
| Browser → backend | `Authorization: Bearer <super-admin JWT>`. The backend verifies the token against the auth database and requires the `super-admin` role. A missing token returns 401 with `{"message":"Unauthorized: No token provided"}`. |
| Backend → judgement service | The backend adds `x-internal-service-key`, `x-admin-user-id`, `x-admin-role`, `x-admin-email` and `x-request-id`. Search routes add `x-api-key` for the search module. Callers never send these themselves. |
| Calling the service directly | Library and pipeline routes accept a Super Admin JWT signed with the shared `JWT_SECRET`, or the internal service key. Search routes accept `x-api-key` or `Authorization: Bearer <JUDMENT_API_KEY>`. |
| Health | `GET {judgement-service}/health` needs no credentials and returns `{"success":true,"service":"judgement-service","status":"ok"}`. |

---

## 5. Library endpoints

### `POST /api/judgements-admin/library/upload`

Upstream: `POST /api/judgements/library/upload` · timeout 900 s · used by Admin Uploads

Stores one or more court PDFs as Indian Kanoon-format records. Files are processed sequentially; the response arrives when every file is searchable or rejected.

**Request** · `multipart/form-data`

| Field | Required | Meaning |
|---|---|---|
| `documents` | required | 1 to 20 PDF files, 60 MB each. `document` is accepted for a single file. |
| `title` | optional | Record title. Applied only when exactly one file is sent. |
| `docsource` | optional | Court name as Indian Kanoon spells it, e.g. `Bombay High Court`. |
| `publishdate` | optional | Judgment date, `YYYY-MM-DD`. `judgmentDate` is accepted as an alias. |
| `author`, `bench` | optional | Judge names. Detected from the text when omitted. |
| `allowOcr` | optional | `0` refuses OCR for this request; scanned PDFs then fail with 422. |

**Response** · 200

```json
{
  "success": true,
  "message": "1 stored, 1 duplicate, 0 failed",
  "summary": { "indexed": 1, "duplicate": 1, "failed": 0 },
  "results": [
    {
      "status": "indexed",
      "filename": "Sangeeta_Agarwal_vs_Union_of_India.pdf",
      "tid": "90734245700",
      "title": "Sangeeta Agrawal vs Union Of India & Others on 17 June, 2013",
      "docsource": "Jharkhand High Court",
      "publishdate": "2013-06-17",
      "author": "P.P. Bhatt",
      "bench": "P.P. Bhatt",
      "textChars": 15369,
      "htmlChars": 15690,
      "fetchedAt": "2026-09-03T09:58:07.167Z",
      "upload": {
        "filename": "Sangeeta_Agarwal_vs_Union_of_India.pdf",
        "uploaded_by": "admin@example.com",
        "admin_user_id": 1,
        "page_count": 5,
        "text_source": "pdf_text",
        "sha1": "bed649c4…",
        "extraction_method": "gemini",
        "needs_review": true,
        "court_code": "UNKNOWN",
        "case_name": "Sangeeta Agrawal v. Union Of India & Others"
      },
      "paragraphCount": 7,
      "structure": { "pre": 1, "p": 1, "blockquote": 0 },
      "docsourceResolvedFrom": "text",
      "detectedAuthor": "P.P. Bhatt",
      "detectedBench": "P.P. Bhatt",
      "warnings": [],
      "durationMs": 8400
    },
    {
      "status": "duplicate",
      "filename": "same_judgment_again.pdf",
      "tid": "90734245700",
      "existing": { "tid": "90734245700", "title": "…", "docsource": "…", "publishdate": "…" }
    }
  ]
}
```

**Status codes**

| Status | When |
|---|---|
| 200 | At least one file was stored or found to be a duplicate. |
| 400 | No PDF in the request: `At least one PDF file is required (field "documents")`. |
| 422 | Every file failed. Each item carries `"status": "failed"` and an `error`, for example `The PDF has no usable text layer and Document AI OCR is not configured`. |

Warnings on an indexed file name what could not be resolved: court unknown, no date, no judges detected, no paragraph rows. The record is still stored and can be corrected with the update endpoint.

---

### `GET /api/judgements-admin/library`

Upstream: `GET /api/judgements/library` · used by Admin Uploads

Lists uploaded judgments, newest first. Only records whose tid starts with `9` are returned; Indian Kanoon fetches are excluded. The large `doc` and `text` fields are omitted from rows.

**Query parameters**

| Name | Default | Meaning |
|---|---|---|
| `search` | — | Exact tid, or words matched against title, court, author, bench and text. |
| `page` | 1 | 1-based page number. |
| `size` | 20 | Rows per page, 1 to 200. |

**Response** · 200

```json
{
  "success": true,
  "page": 1,
  "size": 20,
  "total": 2,
  "rows": [
    {
      "tid": "90734245700",
      "title": "Sangeeta Agrawal vs Union Of India & Others on 17 June, 2013",
      "docsource": "Jharkhand High Court",
      "publishdate": "2013-06-17",
      "author": "P.P. Bhatt",
      "bench": "P.P. Bhatt",
      "numcites": 0,
      "numcitedby": 0,
      "casesCited": [],
      "citedBy": [],
      "fetched_at": "2026-09-03T09:58:07.167Z",
      "year": 2013,
      "source": "admin_upload",
      "upload": { "filename": "…", "uploaded_by": "…", "page_count": 5, "text_source": "pdf_text", "needs_review": true },
      "source_url": null
    }
  ]
}
```

---

### `GET /api/judgements-admin/library/{tid}`

Upstream: `GET /api/judgements/library/{tid}` · used by Admin Uploads

Returns one uploaded record with its full text, paragraph count and a view shaped like an Indian Kanoon document response.

**Path parameter**

| Name | Meaning |
|---|---|
| `tid` | An upload tid (`9` followed by ten digits). |

**Response** · 200

```json
{
  "success": true,
  "record": {
    "tid": "90734245700",
    "title": "…",
    "docsource": "Jharkhand High Court",
    "publishdate": "2013-06-17",
    "author": "P.P. Bhatt",
    "bench": "P.P. Bhatt",
    "textChars": 15369,
    "htmlChars": 15690,
    "fetchedAt": "2026-09-03T09:58:07.167Z",
    "upload": { "…": "…" },
    "paragraphCount": 7,
    "document": { "…": "Indian Kanoon /doc-shaped view of the record" },
    "text": " Sangeeta Agrawal vs Union Of India … [full searchable text]"
  }
}
```

**Status codes**

| Status | When |
|---|---|
| 400 | `Not an admin-upload tid` |
| 404 | `Judgment not found in the library` |

---

### `GET /api/judgements-admin/library/{tid}/html`

Upstream: `GET /api/judgements/library/{tid}/html` · streamed · used by Admin Uploads and Judgement Search

Returns the stored judgment HTML. The dashboards render it in a sandboxed frame so an admin sees exactly what the library holds.

**Query parameters**

| Name | Meaning |
|---|---|
| `raw` | `1` returns the bare HTML fragment. Otherwise the fragment is wrapped in a minimal page with the title. |

**Response** · 200 · `text/html`

```http
Content-Type: text/html; charset=utf-8
Cache-Control: no-store

<h2 class="doc_title">Sangeeta Agrawal vs Union Of India &amp; Others on 17 June, 2013</h2>
<h3 class="doc_author">Author: P.P. Bhatt</h3>
<h3 class="doc_bench">Bench: P.P. Bhatt</h3>
<pre id="pre_1">…cause title…</pre>
<p id="p_1">…</p>
```

Errors are JSON: 400 for a non-upload tid, 404 when the record does not exist.

---

### `PUT /api/judgements-admin/library/{tid}`

Upstream: `PUT /api/judgements/library/{tid}` · timeout 300 s · used by Admin Uploads

Edits the descriptive fields of an uploaded record. The body text is recovered from the stored HTML, the record and its paragraphs are rebuilt and replaced under the same tid, and `upload.updated_at` / `upload.updated_by` are recorded.

**Request** · `application/json`

| Field | Meaning |
|---|---|
| `title` | New title. |
| `docsource` | Court name as Indian Kanoon spells it. |
| `publishdate` | `YYYY-MM-DD`. |
| `author`, `bench` | Judge names. |

Send at least one field. An empty string clears a value.

**Response** · 200

```json
{
  "success": true,
  "message": "Library record updated",
  "record": {
    "status": "indexed",
    "tid": "90734245700",
    "title": "Sangeeta Agrawal vs Union Of India on 17 June, 2013",
    "docsource": "Jharkhand High Court",
    "publishdate": "2013-06-17",
    "author": "P.P. Bhatt",
    "bench": "P.P. Bhatt",
    "textChars": 15360,
    "htmlChars": 15681,
    "fetchedAt": "2026-09-03T09:58:07.167Z",
    "upload": { "…": "…", "updated_at": "2026-09-05T04:10:22.410Z", "updated_by": "admin@example.com" },
    "paragraphCount": 7,
    "structure": { "pre": 1, "p": 1, "blockquote": 0 },
    "warnings": [],
    "changed": ["title"]
  }
}
```

**Status codes**

| Status | When |
|---|---|
| 400 | `Nothing to update; editable fields: title, docsource, publishdate, author, bench` · `publishdate must be YYYY-MM-DD` · `Not an admin-upload tid` |
| 404 | `Judgment not found in the library` |
| 422 | `Stored HTML has no body text to rebuild from` |

---

### `DELETE /api/judgements-admin/library/{tid}`

Upstream: `DELETE /api/judgements/library/{tid}` · used by Admin Uploads

Removes the judgment document from `ik_judgments` and every paragraph row for it from `ik_judgment_paragraphs`. The operation is permanent; there is no archive.

**Response** · 200

```json
{
  "success": true,
  "message": "Removed tid 90734245700 from the library",
  "result": {
    "tid": "90734245700",
    "title": "Sangeeta Agrawal vs Union Of India & Others on 17 June, 2013",
    "…": "counts of the removed judgment and paragraph rows"
  }
}
```

**Status codes**

| Status | When |
|---|---|
| 200 | Removed. |
| 400 | `Not an admin-upload tid` |
| 404 | `Judgment not found in the library` |

---

## 6. Pipeline report endpoints

The User Pipeline tab reads the whole library, not only admin uploads, through three read-only endpoints. Every one of them takes `sourceType=ik_pipeline`, the only source the dashboard uses; the identifier in the path is the judgment's tid.

### `GET /api/judgements-admin/pipeline-report/summary`

Upstream: `GET /api/judgements/pipeline-report/summary` · used by User Pipeline

Counts and date range for `ik_judgments`, computed with a single aggregation query.

**Query parameters**

| Name | Meaning |
|---|---|
| `sourceType` | `ik_pipeline` (default). |

**Response** · 200

```json
{
  "success": true,
  "sourceType": "ik_pipeline",
  "descriptor": {
    "title": "Indian Kanoon Fallback Pipeline",
    "shortLabel": "User Pipeline",
    "description": "When a user searches a citation that is not available locally, …",
    "steps": [ { "key": "local_lookup", "title": "1. Check local knowledge first", "detail": "…" } ]
  },
  "summary": {
    "totalJudgments": 692,
    "judgmentsWithDate": 690,
    "distinctCourts": 27,
    "firstInsertedAt": "1950-05-26T00:00:00.000Z",
    "latestInsertedAt": "2026-08-29T00:00:00.000Z"
  },
  "stores": {
    "elasticsearch": { "status": "healthy", "count": 692, "index": "ik_judgments" }
  },
  "warnings": []
}
```

The `descriptor` block carries the display text the tab shows above the figures. The `stores.elasticsearch` block is the one that reflects the library; the other store entries are reported for completeness and are not used by the tab.

---

### `GET /api/judgements-admin/pipeline-report`

Upstream: `GET /api/judgements/pipeline-report` · used by User Pipeline

Paged list of every judgment in the library, newest judgment date first. Admin uploads are labelled `admin-upload`; Indian Kanoon fetches are labelled `ik_pipeline`.

**Query parameters**

| Name | Default | Meaning |
|---|---|---|
| `sourceType` | `ik_pipeline` | Source to report on. |
| `search` | — | Words matched against title, court and text, or an exact tid. |
| `limit` | 10 | Rows per page, up to 1000. |
| `offset` | 0 | Rows to skip. |

**Response** · 200

```json
{
  "success": true,
  "sourceType": "ik_pipeline",
  "descriptor": { "…": "…" },
  "judgments": [
    {
      "judgmentUuid": "90734245700",
      "canonicalId": "90734245700",
      "caseName": "Sangeeta Agrawal vs Union Of India & Others on 17 June, 2013",
      "courtCode": "Jharkhand High Court",
      "judgmentDate": "2013-06-17",
      "year": 2013,
      "sourceType": "admin-upload",
      "status": "indexed",
      "esDocId": "90734245700",
      "createdAt": "2026-09-03T09:58:07.167Z",
      "updatedAt": "2026-09-03T09:58:07.167Z",
      "stores": { "elasticsearch": true }
    }
  ],
  "meta": { "total": 692, "limit": 10, "offset": 0, "search": "", "hasMore": true, "index": "ik_judgments" },
  "warnings": []
}
```

---

### `GET /api/judgements-admin/pipeline-report/{tid}`

Upstream: `GET /api/judgements/pipeline-report/{tid}` · used by User Pipeline

One judgment from the library with its metadata, searchable text and stored HTML. Works for both Indian Kanoon fetches and admin uploads.

**Path parameter**

| Name | Meaning |
|---|---|
| `tid` | The judgment's tid as returned by the list. |

**Response** · 200

```json
{
  "success": true,
  "sourceType": "admin-upload",
  "upload": {
    "documentId": "90734245700",
    "judgmentUuid": "90734245700",
    "originalFilename": "Sangeeta Agrawal vs Union Of India & Others on 17 June, 2013",
    "sourceUrl": null,
    "status": "indexed",
    "metadata": { "caseName": "…", "courtCode": "Jharkhand High Court", "judgmentDate": "2013-06-17", "year": 2013 },
    "createdAt": "2026-09-03T09:58:07.167Z"
  },
  "judgment": {
    "judgment_uuid": "90734245700",
    "case_name": "…",
    "court_code": "Jharkhand High Court",
    "judgment_date": "2013-06-17",
    "year": 2013,
    "source_type": "admin-upload",
    "status": "indexed",
    "es_doc_id": "90734245700"
  },
  "textPreview": " Sangeeta Agrawal vs Union Of India … [full text]",
  "htmlDoc": "<h2 class=\"doc_title\">… [stored HTML]",
  "stores": {
    "elasticsearch": { "status": "healthy", "present": true, "docId": "90734245700", "index": "ik_judgments" }
  },
  "warnings": []
}
```

For an Indian Kanoon fetch, `sourceType` is `ik_pipeline` and `sourceUrl` points at `https://indiankanoon.org/doc/{tid}/`. That link is never valid for an upload, so it is `null` there.

**Status codes**

| Status | When |
|---|---|
| 404 | No judgment with that tid in the library. |

---

## 7. Search endpoints

The Judgement Search page calls the search module through the backend. The backend attaches the module's API key, so the browser only needs its Super Admin token. Timeout for search calls is 240 seconds.

### `POST /api/judgements-admin/search/hybrid`

Upstream: `POST /api/judment-api/search/hybrid` · timeout 240 s · used by Judgement Search

Runs a full-text search over the judgment library and a semantic search over embedded chunks in parallel, then returns both. If the semantic leg is unavailable the call still succeeds with full-text results and a warning.

**Request** · `application/json`

| Field | Default | Meaning |
|---|---|---|
| `query` | required | Search text. |
| `judgmentLimit` | 10 | Full-text results, up to 50. |
| `chunkLimit` | 8 | Semantic chunk results, up to 50. |
| `scoreThreshold` | `null` | Minimum semantic score, 0 to 1. `null` disables the cut-off. |
| `phraseMatch` | `false` | Match the query as a phrase instead of individual terms. |
| `operator` | `and` | `and` requires every term; `or` accepts any. |
| `sourceScope` | `admin_uploaded` | `admin_uploaded`, `user_generated` or `all`. The library is included unless the scope is `user_generated`. |
| `filters` | `{}` | Optional `courtCode`, `year`, `judgmentUuid`, `canonicalId` applied to the semantic leg. |

```json
{
  "query": "Section 3H of the National Highways Act",
  "judgmentLimit": 5,
  "chunkLimit": 5,
  "scoreThreshold": null,
  "phraseMatch": false,
  "sourceScope": "admin_uploaded"
}
```

**Response** · 200

```json
{
  "success": true,
  "requestId": "7b0d0d2e-…",
  "totalDurationMs": 812,
  "query": "Section 3H of the National Highways Act",
  "searchMode": "hybrid",
  "requestedSourceScope": "admin_uploaded",
  "fullText": {
    "searchMode": "full_text",
    "limit": 5,
    "phraseMatch": false,
    "operator": "and",
    "sources": { "judgmentsIndex": 0, "library": 1, "libraryIncluded": true },
    "totalResults": 1,
    "timings": { "elasticMs": 61, "dbMs": 4, "signedUrlMs": 0 },
    "results": [
      {
        "relevanceScore": 94,
        "rawScore": 18.42,
        "judgment": {
          "judgmentUuid": "90734245700",
          "caseName": "Sangeeta Agrawal vs Union Of India & Others on 17 June, 2013",
          "courtCode": "Jharkhand High Court",
          "judgmentDate": "2013-06-17",
          "year": 2013,
          "sourceType": "admin-upload",
          "sourceBucket": "admin_uploaded",
          "author": "P.P. Bhatt",
          "bench": "P.P. Bhatt",
          "library": true,
          "libraryTid": "90734245700",
          "libraryIndex": "ik_judgments"
        },
        "document": { "documentId": "90734245700", "uploadStatus": "indexed", "originalFilename": "…", "createdAt": "…" },
        "highlights": { "fullText": ["…<em>Section 3H</em> (4) of the <em>National</em>…"], "caseName": [] }
      }
    ],
    "warnings": []
  },
  "semantic": {
    "searchMode": "semantic",
    "limit": 5,
    "totalResults": 0,
    "results": [],
    "unavailable": true,
    "unavailableReason": "Semantic search is unavailable (…). Showing Elasticsearch full-text matches only."
  },
  "totalResults": { "semanticChunks": 0, "fullTextJudgments": 1 },
  "timings": { "embeddingMs": 0, "qdrantMs": 0, "elasticMs": 61, "dbMs": 4, "signedUrlMs": 0 },
  "warnings": [ { "store": "qdrant", "message": "Semantic search is unavailable (…)" } ]
}
```

Library hits carry `library: true` and `libraryTid`; the page uses them to show the "Judgment Library" badge and to open the record through `GET /library/{tid}/html`.

**Status codes**

| Status | When |
|---|---|
| 400 | `query is required` |
| 502 | `JUDMENT_API_AUTH_FAILED` when the backend's search API key is rejected upstream; `JUDMENT_API_UNAVAILABLE` when the service cannot be reached. |

---

### `GET /api/judgements-admin/search/analytics`

Upstream: `GET /api/judment-api/analytics` · used by Judgement Search

Recent search requests with their parameters, result counts and per-stage timings. Every search call, including failures, writes one row.

**Query parameters**

| Name | Default | Meaning |
|---|---|---|
| `limit` | 50 | Rows to return, up to 200. The page asks for 10. |
| `endpoint` | — | Filter: `hybrid_search`, `full_text_search`, `semantic_search`, `analytics_list`. |
| `success` | — | `true` or `false` to filter by outcome. |

**Response** · 200

```json
{
  "success": true,
  "requestId": "c1e5a5b0-…",
  "totalDurationMs": 9,
  "analytics": [
    {
      "request_id": "7b0d0d2e-…",
      "endpoint": "hybrid_search",
      "search_mode": "hybrid",
      "query_text": "Section 3H of the National Highways Act",
      "filters": { "sourceScope": "admin_uploaded" },
      "semantic_limit": 5,
      "text_limit": 5,
      "score_threshold": null,
      "phrase_match": false,
      "status_code": 200,
      "success": true,
      "result_count": 1,
      "embedding_duration_ms": 0,
      "qdrant_duration_ms": 0,
      "elastic_duration_ms": 61,
      "db_duration_ms": 4,
      "total_duration_ms": 812,
      "error_message": null,
      "created_at": "2026-09-05T04:12:41.902Z"
    }
  ]
}
```

---

## 8. Errors

Two envelopes appear, depending on where the error originates.

**Raised by the admin backend** — returned with 502 when the judgement service cannot be reached at all. `details` carries the underlying network error and is the first thing to read when a call fails without a JSON body from the service.

```json
{
  "success": false,
  "error": {
    "code": "JUDGEMENT_SERVICE_UNAVAILABLE",
    "message": "Judgement service is unavailable",
    "details": "connect ECONNREFUSED …"
  },
  "requestId": "b0636b60-…"
}
```

**Relayed from the judgement service** — the backend passes the service's status code and body through unchanged, so 400, 404 and 422 arrive exactly as the service produced them. Search errors add `requestId` and `totalDurationMs`.

```json
{
  "success": false,
  "message": "Judgment not found in the library"
}
```

| Status | When |
|---|---|
| 401 | Missing or invalid Super Admin token at the backend, or an invalid token or service key at the judgement service. |
| 403 | Authenticated, but the role is not `super-admin`. |
| 400 | Malformed input: no PDF, nothing to update, bad date, or a tid that is not an admin upload. |
| 404 | The tid is not in the library. |
| 422 | The content could not be processed: no usable text layer, OCR unavailable, or every file in a batch failed. |
| 502 | The backend could not reach the judgement service, or the search module rejected the backend's API key. |

---

## 9. Limits and configuration

| Limit | Value | Set by |
|---|---:|---|
| PDFs per upload request | 20 | `LIBRARY_UPLOAD_MAX_FILES` on the judgement service; `VITE_LIBRARY_UPLOAD_MAX_FILES` mirrors it in the browser |
| Size per PDF | 60 MB | `LIBRARY_UPLOAD_MAX_BYTES` |
| Text-layer threshold before OCR | 120 chars/page | `LIBRARY_UPLOAD_MIN_CHARS_PER_PAGE` |
| Library list page size | 1 to 200 | fixed |
| Pipeline list page size | 1 to 1000 | fixed |
| Search result limits | 1 to 50 | fixed, per leg |
| Analytics rows | 1 to 200 | fixed |
| Proxy timeout, default | 600 s | `JUDGEMENT_PROXY_TIMEOUT_MS` on the backend |
| Proxy timeout, upload / update / search | 900 / 300 / 240 s | fixed minimums |

**Service settings that shape these endpoints**

| Variable | Where | Effect |
|---|---|---|
| `JUDGEMENT_SERVICE_URL` | Backend | Origin of the judgement service the backend forwards to. Must point at the deployed Node service, not at Elasticsearch. |
| `JUDGEMENT_INTERNAL_API_KEY` / `INTERNAL_SERVICE_KEY` | Backend and service | Shared key the backend sends on every forwarded call. Must match on both sides. |
| `JUDMENT_API_KEY` | Backend and service | Key for the search module, sent by the backend as `x-api-key`. |
| `JWT_SECRET` | Backend and service | Same secret on both, so a Super Admin token can also be presented directly to the service. |
| `ELASTIC_URL` / `ELASTICSEARCH_URL`, `ELASTICSEARCH_USERNAME`, `ELASTICSEARCH_PASSWORD` | Service | The shared cluster. TLS is accepted without verification. |
| `IK_JUDGMENTS_INDEX`, `IK_PARAGRAPHS_INDEX` | Service | Index names; defaults `ik_judgments` and `ik_judgment_paragraphs`. Must match the Python library service. |
| `DOCUMENT_AI_PROCESSOR_ID`, `DOCUMENT_AI_LOCATION`, `GCS_KEY_BASE64` | Service | OCR for scanned PDFs. When unset, scanned PDFs are rejected with 422. |
| `GOOGLE_API_KEY`, `JUDGEMENT_METADATA_MODEL` | Service | Gemini metadata extraction. Without a key only the heuristics run. |
| `JUDMENT_API_DEFAULT_SOURCE_SCOPE` | Service | Default `sourceScope` for search when the request omits it. Default `admin_uploaded`. |
