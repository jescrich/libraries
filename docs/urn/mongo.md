# Using in MongoDB

## Introduction to URNs in MongoDB

Uniform Resource Names (URNs) are globally unique, persistent identifiers assigned to resources. A URN is essentially a location-independent, permanent name for a resource. Unlike a URL (which might break if the resource moves), a URN remains stable as an identifier even if the underlying resource changes location or form. In practical terms, a URN looks like a string with a special format, for example: `urn:namespace:resourceID`. The URN scheme ensures uniqueness and persistence, often through a namespace registration (e.g., ISBN numbers for books can be represented as `urn:isbn:...`).

**Why use URNs in a MongoDB application?** URNs provide a way to uniquely identify records across different systems and time. In a MongoDB application, you might use URNs as identifiers for documents when you need a string ID that is meaningful outside the database or guaranteed unique across databases. Common use cases include:

- **Global Identifiers**: Using URNs as a primary key or unique field for each document. For instance, an application might assign each user a URN like `urn:myapp:user:12345`. This can be especially useful in microservice architectures or integrations, where an identifier needs to be recognized system-wide, not just by an internal ObjectId. URNs are guaranteed unique and can be shared externally without exposing internal database ids.

- **Composite Keys**: URNs can encode multiple pieces of identifying information in one string. For example, an IoT device might be identified by `urn:company:device:location:123`. Storing this in MongoDB means one field carries a lot of identity info. Systems like LinkedIn’s **DataHub** project use URNs to encode entity keys; they serialize key fields into a single URN string for primary key lookups.

- **External References**: If your MongoDB documents reference external resources (like books, users from another system, or files), storing their URNs allows you to easily join or look them up. For example, a library database might store `bookURN` in a document as `urn:isbn:9780131101630` to uniquely refer to a book by its ISBN URN.

- **Permanence and Consistency**: URNs are intended to be persistent. In a MongoDB context, this means you can use a URN to refer to a document even if that document gets copied to another collection or migrated – the name stays the same. This is useful for audit logs or historical references where you store the URN instead of an internal ID that might change.

Overall, URNs are useful in MongoDB when you need human-readable yet globally unique identifiers that remain consistent across different contexts and over time. Next, we’ll look at how to store and index these URN strings efficiently.

[The Metadata Model | DataHub](https://datahubproject.io/docs/metadata-modeling/metadata-model/#:~:text=,requiring%20a%20fully%20materialized%20struct)

## Proper Indexing for URNs

Indexes are critical for efficient data retrieval in MongoDB. Without an index on the URN field, any query by URN would require MongoDB to scan every document in the collection (a collection scan) to find matches. This is **very slow** for large collections . By indexing URNs properly, we can ensure queries are fast and avoid full collection scans. In this section, we’ll cover different indexing strategies for URN fields.

[Interpret Explain Plan Results - MongoDB Manual v8.0](https://www.mongodb.com/docs/manual/tutorial/analyze-query-plan/#:~:text=,indicate%20a%20collection%20scan)

### Single-Field Indexes for URNs

The most straightforward index is a single-field index on the URN field itself. This index stores all URN values in sorted order and allows MongoDB to quickly locate any given URN. If you frequently query by the full URN (exact matches), a single-field index is essential. It turns those queries into O(log N) index lookups instead of O(N) collection scans.

- **Creating a URN Index**: You can create an index on the URN field with the Mongo shell or a driver. For example, in the shell:  
  ```js
  db.collection.createIndex({ urn: 1 });
  ```  
  This creates an ascending index on the `urn` field. With a driver (e.g., Node.js), it would be `collection.createIndex({ urn: 1 })`. Once this index is in place, any query like `find({ urn: "urn:myapp:user:12345" })` will use the index to directly locate the document, instead of scanning all documents.

- **Unique Index**: If each URN is supposed to be unique in the collection, declare the index as unique to enforce this rule:  
  ```js
  db.collection.createIndex({ urn: 1 }, { unique: true });
  ```  
  A unique index causes MongoDB to reject any duplicate URN on insert/update. This not only ensures data integrity (no two documents share the same URN) but can also marginally improve read performance because the query planner knows at most one document will match a given URN. Unique indexes are ideal when URNs serve as an external primary key (similar to how `_id` works by default).

  [Index Properties - MongoDB Manual v8.0](https://www.mongodb.com/docs/manual/core/indexes/index-properties/#:~:text=Unique%20Indexes)

- **Index Performance**: Queries using an equality match on a indexed URN field are very fast. The index lookup will examine only a few b-tree nodes to find the URN, and then directly fetch the document. In contrast, without an index, the database would perform a collection scan (noted as `COLLSCAN` in an explain plan), examining every document – an operation that *“had to scan the entire collection… and can result in slow queries.”*. Thus, indexing the URN field is a fundamental optimization.

  [Interpret Explain Plan Results - MongoDB Manual v8.0](https://www.mongodb.com/docs/manual/tutorial/analyze-query-plan/#:~:text=Collection%20scans%20indicate%20that%20the,can%20result%20in%20slow%20queries)

*Tip:* If URNs are your main way of identifying documents, you might even consider using the URN as the MongoDB `_id` of the document. The `_id` field is indexed by default. By assigning each document an `_id` equal to its URN, you automatically get a unique index on URNs without creating a separate index. The downside is that `_id` indexes store the full URN string (which could be long) and that becomes the primary key in the storage engine. In many cases this is fine, but be mindful if URNs are very large strings as it can bloat the index size slightly.

### Compound Indexes for URN Segments

Sometimes you might not always query by the entire URN; instead, you query by parts of it or by URN in combination with other fields. In these cases, a **compound index** can be beneficial. A compound index indexes multiple fields together in a single index structure. 

If your URNs have a structured format (e.g., `urn:Namespace:ResourceID:SubID`), and you frequently query by a prefix or some component, you can store those components in separate fields and create a compound index. Similarly, if queries include the URN plus some other field (like a type or category), a compound index on `[otherField, urn]` might be useful.

- **Example – Namespace and ID**: Suppose our URNs are of the form `urn:org:department:assetId`. We could store each part in its own field, e.g., `{ org: "...", department: "...", assetId: "..." }` in addition to the full URN. A compound index on `{ org: 1, department: 1, assetId: 1 }` would allow efficient queries on any combination of those fields. For instance, finding all assets in a given org and department would use the index to quickly retrieve matches. Even queries that only specify `org` could use the first part of this index (because the index is ordered first by org) to narrow down results. However, a query only on `assetId` (the third field) **cannot** use this index unless `org` (and `department`) are also specified, due to how compound indexes work (they are ordered by the first field, then second, etc.). In such cases, you might create additional indexes or reconsider the query structure.

- **Combining URN with Other Fields**: If your queries often include another field along with the URN, consider a compound index. For example, if your collection has a `type` field (indicating the kind of entity the URN refers to) and your queries are like `{ type: "user", urn: "urn:app:user:1001" }`, an index on `{ type: 1, urn: 1 }` would be beneficial. MongoDB could use this index to find the specific URN *within* the subset of documents of type "user". This is more efficient than using the URN index alone and then filtering by type, especially if the collection contains many types.

- **Performance**: Compound indexes can improve performance and even enable index-only queries (covered queries). By having multiple fields indexed together, the database can sometimes answer the query using just the index data without touching the actual documents, if all queried fields and returned fields are in the index. *“A compound index on commonly queried fields increases the chances of covering those queries... without examining any documents. This optimizes query performance.”* In our context, if we frequently query by just the URN and maybe one other field, a single-field URN index might suffice. But if we query by URN segments or need to filter by an additional field, compound indexes shine.

  [Compound Indexes - MongoDB Manual v8.0](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-compound/#:~:text=A%20compound%20index%20on%20commonly,This%20optimizes%20query%20performance)

When designing compound indexes for URNs, consider your query patterns. Include in the index the fields that you use to filter results (and perhaps to sort results) alongside the URN. The order of fields in a compound index matters: it should typically reflect the query structure (e.g., if you always filter by `type` and then search by `urn`, put `type` first, then `urn`). If you sometimes query solely by URN, ensure that the compound index has URN as the first field or keep a separate single-field index on URN, because a query just on URN cannot use an index where URN is not the prefix.

### Partial Indexes for URNs

Partial indexes are an advanced feature that allow indexing only a subset of documents in a collection, rather than all documents. This is useful when the index is only needed for documents that meet a certain condition. By indexing fewer documents, the index uses less space and has lower maintenance overhead.

In the context of URNs, you might use a partial index if, for example, not every document has a URN (and you only care to index those that do), or if the collection stores multiple entity types but URN queries are common only for one type.

[Partial Indexes - MongoDB Manual v8.0](https://www.mongodb.com/docs/manual/core/index-partial/#:~:text=Partial%20indexes%20only%20index%20the,for%20index%20creation%20and%20maintenance).

**When to use partial indexes:**

- **Conditional Indexing**: Suppose your collection stores different kinds of entities, and only some have a URN. For instance, documents of type "file" have a URN, but documents of type "message" do not (or you never search messages by URN). You could create a partial index on `urn` with a filter `{ type: "file" }`. This means only documents where `type` is "file" and that have a URN will be indexed on the URN field. The result is a smaller index containing just the entries you care about, which *“have lower storage requirements and reduced performance costs for index creation and maintenance.”*. It’s more efficient than indexing every document when only a subset will ever be queried by URN.

- **Performance Trade-off**: Because the index is smaller, write operations (inserts/updates) are a bit faster for non-indexed documents, and the index uses less RAM. However, be careful: a query can only use a partial index if the query condition ensures it only looks at indexed documents. In our example, a query `{ urn: "urn:app:file:2021:report" }` **without** specifying `type: "file"` will **not** use the partial index, because MongoDB cannot be sure that a document with that URN (if of a different type) isn't missing from the index. To use the partial index, the query must include the condition `{ type: "file" }` (or whatever the partial filter is) or otherwise the query planner might ignore that index. In practice, this means you use partial indexes when your queries naturally include that filtering condition or when you can modify your queries to include it.

- **Creating a Partial Index**: Using the shell as an example:  
  ```js
  db.collection.createIndex(
    { urn: 1 },
    { partialFilterExpression: { type: "file" } }
  );
  ```  
  This will index `urn` only for documents where `type` is "file". If you also only want to index URNs that exist (skip documents where `urn` field is missing or null), you could use a filter like `{ urn: { $exists: true } }` as well. Partial index filters can be any query expression. Keep them simple for performance; equality or existence checks are common. (Using regex in a partial filter is possible but might not be as straightforward and could be slower to evaluate on each insert; often, a field indicating type or category is better.)

In summary, partial indexes are great for *sparse* use cases where you don’t need to index every document. They can reduce index size significantly. Just ensure your query patterns align with the indexed subset. MongoDB’s documentation suggests partial indexes should be preferred over the old sparse indexes due to more control and flexibility.

### Wildcard Indexes for URNs

MongoDB introduced wildcard indexes (`$**` indexes) to index **arbitrary fields** in documents without explicitly naming them. They are useful in schemas where field names or structures vary widely and you still want to support queries on those fields. A wildcard index will index all fields (or all fields under a specific subtree) in each document. 

For URNs, wildcard indexes are usually *not* needed if you have a dedicated `urn` field, because you can just index that field directly (which will be more efficient). However, consider scenarios like: URNs might appear as keys in a sub-document, or you have multiple different URN fields in different document types. In such cases, a wildcard index could catch all of them.

- **Use Case**: Suppose in one set of documents the field name is `resourceUrn`, in another it's `itemUrn`, and in others, URNs could even be inside an array or a nested object. If you cannot standardize the field name, a wildcard index on `$**` would index every field, so any query on any field named "*Urn" would be supported by the index. Wildcard indexes **“support queries against arbitrary or unknown fields”**, so you don't have to predict the field name in advance.

  [Wildcard Indexes - MongoDB Manual v8.0](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-wildcard/#:~:text=document%20field%20names%20may%20differ,against%20arbitrary%20or%20unknown%20fields)

- **Creating Wildcard Index**: The syntax is simple. For example, to index all fields in a collection:  
  ```js
  db.collection.createIndex({ "$**": 1 });
  ```  
  This single index now acts as an index on every field in each document. You can also target a specific subdocument, e.g., `{ "attributes.$**": 1 }` to index all keys under an `attributes` field of each document. Wildcard indexes can be combined with a projection to include/exclude certain fields from being indexed.

- **Performance Considerations**: Wildcard indexes are powerful but come with a cost. MongoDB’s advice is, *“Only use wildcard indexes when the fields you want to index are unknown or may change. Wildcard indexes don't perform as well as targeted indexes on specific fields.”*. In other words, if you **know** you have a field (like `urn`) that you will query, **use a normal index on that field**. A targeted index is smaller and faster. Wildcard indexes index potentially *lots* of data you might never query, so they consume more disk and memory, and every document write has more overhead (because many field values might be indexed). 

- **When appropriate**: If URNs are deeply nested or appear under varying keys such that maintaining specific indexes is impractical, a wildcard index could be a fallback. For example, if documents have a structure where URN could be a key in a dynamic map of identifiers, you could index that entire map. But for the common case – a single `urn` field on each document – stick with a normal index. Wildcard indexes are not a replacement for good schema design or for well-planned indexes on known query patterns.

[Performance Best Practices: Indexing | MongoDB Blog](https://www.mongodb.com/blog/post/performance-best-practices-indexing#:~:text=Wildcard%20Indexes%20Are%20Not%20a,Based%20Index%20Planning)

In summary, for most MongoDB applications dealing with URNs, you will use single-field indexes on the URN field and possibly compound indexes if you query by URN plus other fields. Partial indexes might be used in special cases to limit index size, and wildcard indexes are rarely needed unless your URNs live in unpredictable places in the document. Next, we’ll discuss how to query these URNs efficiently using these indexes.

## Querying URNs Without Performance Issues

Once your URNs are stored and indexed properly, the next step is formulating queries that take advantage of those indexes. In this section, we’ll cover patterns for querying URN fields efficiently, including exact matches and partial matches (like searching by segments of a URN), and how to use operators like `$regex`, `$expr`, and `$text` without hurting performance. The goal is to retrieve the data you need **without** causing MongoDB to revert to a collection scan or other expensive operations.

### Exact Match Queries by URN

The most efficient query you can do on an indexed field is an exact match (equality) query. If you want to retrieve the document for a given URN and you have an index on `urn`, it's a simple and fast operation:

- **Equality Query**: For example, `db.resources.findOne({ urn: "urn:app:user:1001" })` will use the index on `urn` (if present) to locate the document with that URN directly. This will result in an index lookup followed by at most one document fetch. The index lookup is very fast even if your collection has millions of documents, because it narrows down to a specific value. If the URN is unique, the database knows there will be at most one match. As noted earlier, unique indexes are great for such scenarios: *“Unique indexes cause MongoDB to reject duplicate values... useful when your documents contain a unique identifier”* like a URN.

- **Performance**: An exact-match URN query on an indexed field should examine only a handful of index entries and at most one document. In an `explain()` plan, this would show up as an `IXSCAN` (index scan) with perhaps `totalKeysExamined: 1` and `totalDocsExamined: 1` (if one document was found). In contrast, the same query without an index would do a `COLLSCAN` (collection scan), examining every document until it finds the match. If your collection had 1,000,000 documents, that could mean scanning all million documents just to find the one that matches – clearly something to avoid. As a reminder, *“collection scans indicate that the mongod had to scan the entire collection document by document to identify the results... a generally expensive operation”* .

- **Tip**: Always ensure that any field you query by exact value frequently (like URN) is indexed. If you find in your logs or monitoring that queries on URNs are slow, double-check index existence. Sometimes, developers forget to add an index or assume one exists. The `_id` field is indexed by default, but a custom `urn` field is not indexed unless you explicitly create one (or use it as `_id`). 

[Index Properties - MongoDB Manual v8.0](https://www.mongodb.com/docs/manual/core/indexes/index-properties/#:~:text=Unique%20indexes%20cause%20MongoDB%20to,userId)

[Interpret Explain Plan Results - MongoDB Manual v8.0](https://www.mongodb.com/docs/manual/tutorial/analyze-query-plan/#:~:text=,indicate%20a%20collection%20scan)

Exact match queries are straightforward: as long as the index is in place, you should not run into performance issues. Now, let’s move to more complex scenarios: partial matches and segment queries on URNs.

### Querying by URN Segments (Partial URN Queries)

Often, URNs contain multiple segments of information and you might want to query by just one part of the URN. For example, you might want all resources in a certain namespace (`urn:namespace:*`) or all resources of a certain type embedded in the URN. There are safe ways to do this, and some not-so-efficient ways. Let's explore strategies:

**1. Query by Prefix (Starts with a certain segment):** If you want all URNs that begin with a certain prefix, you can leverage the index by using a prefix query. The best way to do a prefix query in MongoDB is with a regex that has an anchor at the beginning (`^`). For instance, to get all URNs in the `"file"` category from our earlier example data, you might do:
```js
db.resources.find({ urn: { $regex: /^urn:app:file:/ } });
```
This finds any document whose URN starts with `urn:app:file:`. Because the regex is **anchored to the start** and the prefix is a literal string, MongoDB can use the index on `urn` to optimize this. The query planner recognizes this as a "prefix expression", meaning all matches start with the same prefix string. It will **construct a range scan on the index** to efficiently retrieve only those index entries that match the prefix. In other words, it treats the query similar to a range query `urn >= "urn:app:file:" AND urn < "urn:app:file;"` (the next string after the prefix) under the hood. This is very efficient. The index scan will only cover URNs with that prefix, not the whole index.

*Why regex and not `$startsWith`?* MongoDB query language doesn't have a `$startsWith` operator for strings, so the common approach is using a regex with `^`. You could also use a range query on strings if you calculate the boundary values, but regex is simpler and clear.

**2. Query by a Middle or Suffix Segment:** This is trickier. For example, “find all URNs where the third segment is ‘2021’.” If your URN format is fixed (say always `urn:app:file:YEAR:...`), you can similarly anchor a regex pattern: `^urn:app:file:2021:`. This is still a prefix from the perspective of the string (it just happens that the prefix includes multiple segments). That will use the index as described. However, if you wanted something like "any URN that has `:2021:` *somewhere in it*, regardless of preceding part", you cannot create a simple index-supported query without restructuring data. A regex like `/2021/` (not anchored) will **not** use the index effectively; it will cause a scan of either the entire collection or the entire index (which we discuss in the regex section below).

For segments that are not at the start, one strategy is to store those segments in separate fields as mentioned earlier. For instance, if you often need to query by the year in a `urn:app:file:YEAR:project:...`, then store the year in its own field (`year: 2021`) when inserting the document. Then you can simply query `{ year: 2021 }` (and possibly `type: "file"` if needed) to get those documents. This approach uses a normal equality query on an indexed field (much faster than any regex on the middle of a string). In our example data, we did include a `year` field for that reason. A query `{ type: "file", year: 2021 }` will use a compound index on `{type, year}` to fetch the matching documents immediately.

If restructuring data is not possible and you must query by a middle segment via the URN string, you might resort to a regex with wildcards (like `/^urn:app:[^:]+:2021:/` using a wildcard `[^:]+` for the unknown segment). Note that **this cannot use an index** starting at the beginning in the general case, because the prefix is not fixed up to the segment you care about. The regex engine would have to test each URN. So this approach would result in an index scan of all URNs (still better than scanning full documents, but potentially slow if the index is large). We'll cover more on regex performance in the next section. 

**3. Using Text Search for URN components:** Another approach for partial segments is to use MongoDB's text search. If you create a text index on the URN field, MongoDB will tokenize the string by delimiters (colons, etc.). Each distinct token (word) becomes an entry in a full-text index. For example, the URN `"urn:app:file:2021:projectA:report"` might be tokenized into ["urn", "app", "file", "2021", "projectA", "report"] in a text index (the exact tokenization rules depend on the text analyzer, but generally non-alphanumeric characters are separators). Then you could search for `"2021"` using a text query: `db.resources.find({ $text: { $search: "2021" } })`. This would find documents whose URN contains the token "2021" without scanning everything, because the text index is built for such searches. 

Text indexes are powerful for searching "words" in a string field. As the MongoDB documentation notes, *“Regular indexes are useful for matching the entire value of a field. If you only want to match on a specific word in a field... then use a text index.”*. In our case, the URN segments can be considered "words". A text index query is especially useful if the segment you want might occur in different positions, or if you want to allow searching any part of the URN without designing multiple indexes.

However, there are caveats: text search is case-insensitive by default and may ignore certain tokens (e.g., it might consider "urn" or common words as noise depending on the language settings). Also, you can have at most one text index per collection, so if you're already using text search for other fields, you have to combine them. And text search does not guarantee an exact match of the segment unless the segment is delineated (for example, searching "202" would also match "2021" as a partial word which might be undesirable). But for broad partial matching, it's an option.

**In practice:** If partial URN searches (by segment) are a core requirement, the most robust solution is usually to store redundant information: keep the URN as a whole (for uniqueness and full reference) and also store whichever parts you need to query on in separate fields. Then index those fields. This avoids the complexity of regex and text search, and makes your queries straightforward and index-supported. For example, store `namespace`, `year`, `project` in fields and index them. The storage overhead is minor and the query performance gain is significant. This denormalization is common when working with structured identifiers in MongoDB.

### Using Regular Expressions Safely for URN Searches

Regular expressions (`$regex`) in MongoDB queries allow pattern matching on string fields, which can be useful for partial matches on URNs. But regex must be used with care, as it can easily negate the benefit of indexing if used incorrectly. Here’s how to use regex on URNs *without* killing performance:

- **Anchored Prefix Regex**: As mentioned, a regex that looks for a prefix is the safest. E.g., `/^urn:app:file:/` will match any string that starts with `urn:app:file:`. Because this is anchored at the beginning (`^`) and followed by a literal string, MongoDB treats it as a prefix search and can use an index on `urn`. The query engine will limit the scan to the range of index keys that start with that prefix, which is very efficient. In an explain plan, such a query would still use an index scan (`IXSCAN`). The *MongoDB Manual* states: *“If an index exists for the field, then MongoDB matches the regular expression against the values in the index, which can be faster than a collection scan. Further optimization can occur if the regular expression is a 'prefix expression' ... This allows MongoDB to construct a 'range' from that prefix and only match against those index values.”* . In simpler terms, a regex like `^prefix` avoids scanning the whole index by narrowing it down to the prefix range.

- **Unanchored or Substring Regex**: Avoid these for routine queries. A query like `{ urn: /projectA/ }` (to find URNs containing "projectA" somewhere) cannot use an index to jump to the first occurrence of "projectA" because it's not anchored to the start of the string. What MongoDB does in this case (if an index on `urn` exists) is it will scan **all the index entries** and test each against the regex. Scanning the entire index is somewhat better than scanning the entire collection (scanning index keys is usually less I/O than documents, and can be done entirely in memory if the index is in RAM), but it's still *O(N)* in the number of URNs. For large collections, this is slow. The Stack Overflow explanation puts it succinctly: for a regex `/pattern/` without an anchor, MongoDB will do a full index scan and then fetch matched documents. So, it's effectively visiting every URN. 

  In an explain plan, this might still show as an `IXSCAN`, but you'll notice `totalKeysExamined` is very high (close to the number of documents) and many keys might be examined per returned result. This is a red flag if seen in production for a frequently-run query.

- **Leading Wildcard**: A regex that starts with `.*` or `%` (SQL LIKE style) is the worst-case for an index. For example, `/.*projectA/` or `/projectA$/` (endswith without specifying what comes before) cannot use the index at all in a meaningful way. MongoDB cannot determine a starting point in the index for such patterns, so it will *not* use the index (even an index scan) and will resort to a full **collection scan**. These kinds of patterns should be avoided or handled differently (perhaps via text search or by restructuring data as mentioned).

- **Case-Insensitive Regex**: Note that using the `i` option (case-insensitivity) on a regex also prevents index use in most cases. Indexes in MongoDB are case-sensitive by default (unless you created a collation-specific index). A query `{ urn: { $regex: /^URN:APP:FILE:/i } }` will not utilize a standard index effectively, because the index is ordered by binary values of strings (or by collation rules) and a case-insensitive match isn't a simple contiguous range. If you need case-insensitive URN searches, consider creating a lowercased copy of the URN field and index that, or use a case-insensitive collation on the index. But often URNs are treated as case-sensitive (depending on the specification, portions of URNs can be case-sensitive), so this might not be an issue.

**Safely using regex for partial search:**

- If possible, always formulate regex queries to have a fixed prefix (anchored). For example, searching all resources of a certain year, include the prefix up to that year: `^urn:app:file:2021:` rather than just `2021`. This leverages the index and dramatically reduces the scanned range.
- Do not use regex for general substring searches on large collections without understanding the performance hit. If you must do a substring search and the collection is big, consider using a text index or an aggregation with `$regexMatch` in `$filter` on a smaller subset, or offload such searching to a search engine if it's a complex use case.
- For debugging and one-off needs, an unanchored regex might be fine (for example, an admin tool to find a particular URN fragment), but it should not be part of regular application logic for user queries on large data.

In summary, `$regex` is a useful tool for pattern matching, but to use it “safely” in terms of performance: **make it look like a prefix search** so the database can use the index. As the docs say, a regex is efficient if it *“starts with a caret... followed by a string of simple symbols”*. If your regex pattern can’t be constrained in that way, expect a performance hit and consider alternative approaches.

- ([regex - MongoDB, performance of query by regular expression on indexed fields - Stack Overflow](https://stackoverflow.com/questions/17501798/mongodb-performance-of-query-by-regular-expression-on-indexed-fields#:~:text=,that%20fall%20within%20that%20range))
- ([$regex - MongoDB Manual v4.4](https://www.mongodb.com/docs/v4.4/reference/operator/query/regex/#:~:text=Further%20optimization%20can%20occur%20if,that%20fall%20within%20that%20range))

### Using `$expr` and `$text` for Complex URN Queries

Sometimes your query needs are more complex than what simple field matches and prefixes can handle. MongoDB offers the `$expr` operator to allow the use of aggregation expressions in the query, and the `$text` operator to do text searches. These can be used for URN queries in specific scenarios, but each comes with its own considerations.

**Using `$expr`:** The `$expr` operator lets you use aggregation expressions in a query filter. This means you can perform calculations or transformations on field values for each document and use the result to decide if the document matches. For example, one could theoretically do: 
```js
db.resources.find({ 
  $expr: { 
    $lt: [ { $strLenCP: "$urn" }, 20 ]  // find docs where URN length is less than 20
  } 
});
``` 
This is a contrived example, but shows what $expr can do – here it calculates string length in each doc and compares it.

For URNs, you might consider using `$expr` to, say, split the URN and match one part. e.g., `$expr: { $eq: [ { $arrayElemAt: [ {$split: ["$urn", ":"]}, 2 ] }, "2021" ] }` to check if the third segment is "2021". While this is possible, **it is not efficient on large collections**. The reason is `$expr` essentially forces a document-by-document evaluation. MongoDB **cannot use regular indexes inside an $expr** (except in certain simple cases of field-to-field comparison). In our case, the expression involves splitting a string – there's no index on the result of that operation (unless you had a multi-key index on an array of segments, for example). 

As a result, using `$expr` in a query like this will cause a full collection scan (or at best, a full index scan of some index and then an in-memory filter). According to one analysis, *“$expr cannot take advantage of indexes in the same way as simple queries do... MongoDB has to scan each document in the collection to evaluate the expression”*, which can lead to much slower performance on large datasets. So, while `$expr` is powerful (you can do almost anything in that expression, even call regex there or other functions), it's generally a last resort for querying. It’s most suitable for smaller collections or administrative queries where performance isn’t critical.

**Best practice:** If you find yourself wanting to use `$expr` to query URNs by some computed condition, consider altering your data model. For example, instead of computing on the fly, store that computed value. If you need the 3rd segment frequently, store it in a field when inserting. Then your query is a simple equality on that field, which uses an index. Pre-computation or duplication of data may seem like extra work, but it transforms a potentially expensive runtime computation into a fast index lookup.

**Using `$text`:** As discussed earlier, text indexes allow searching for words within string fields. To use `$text`, you must have a text index created on the field (or a wildcard text index). Once that’s done, you can perform text search queries. For URNs, `$text` could be used to find URNs containing a certain token. For example, if you created `db.resources.createIndex({ urn: "text" })`, you could do:
```js
db.resources.find({ $text: { $search: "projectB" } });
``` 
This would return all documents whose URN contains the token "projectB". Internally, MongoDB will look up "projectB" in the inverted index of the text index, which is very fast (O(log N) or better, and highly optimized for multiple terms).

A text index might treat URN segments as separate terms (most likely splitting on `:`). This means you can search by segment directly. However, be aware that text search has some quirks:
  - It’s case-insensitive by default (so "ProjectB" or "projectb" would match "projectB" in the URN).
  - It may stem words (if language is English, it might reduce plurals, etc.). For URNs that probably doesn’t apply because they are not natural language, but if your URNs contain something like "reports", a text index might interpret that as the stem "report".
  - Punctuation is removed. The colon `:` likely is a separator, which is what we want. But something like `urn:example:00123` might be tokenized into "urn", "example", "00123" (or "123"). So searching "00123" might or might not work as expected if the analyzer treats it as number. You can customize the text index or use `$regex` for numeric segments if needed.

Use `$text` when you need to do searches that aren't strictly prefix or equality and you want better performance than regex. For example, if users need to find any resource with "projectC" in its URN, a text search is ideal. It will use the text index and return results ranked by relevance (or you can sort by something else). Without text index, your only option would be a full index scan with regex or $expr, which is far less efficient.

**Important**: Maintain only necessary text indexes. Text indexes can be large (they create many entries, one per token). If URNs are short and you have at most, say, 5-6 tokens in each, it's not too bad. But it's something to consider. Also, combining text search with other filters can sometimes be tricky (you often have to use `$text` as a standalone filter and then add other conditions, but you cannot include other conditions inside the `$text` clause directly). Ensure that if you combine text search with, say, a type filter, you have indexes to support that combination (maybe a compound text index with that field as a filter, or you do two-phase filtering).

**Summary of $expr and $text**: Use `$expr` sparingly – it's powerful but can be a performance trap if misused, because it tends to bypass indexes. Use `$text` when you need flexible substring or multi-term search and you can afford the overhead of maintaining a text index; it can greatly speed up searches for URN components compared to regex. Always test these queries with explain() to see how they behave (we’ll talk about explain shortly). If an $expr or text query is slow, consider alternative approaches (denormalization, external search service, etc.) based on your use case.

## Performance Optimization

Even with proper indexing and query patterns, it's important to constantly keep performance in mind, especially as your MongoDB dataset grows. In this section, we will discuss how to avoid common performance pitfalls when searching by URN, how to measure the performance of your URN queries using the `explain()` method, and some best practices for maintaining performance in large collections.

### Avoiding Full Collection Scans

A *full collection scan* (in MongoDB explain output, a stage `"COLLSCAN"`) is when the database has to examine every document in the collection to answer a query. As mentioned, this happens when there is no suitable index for the query or if the query cannot use any available index. Full scans are very expensive and scale linearly with your data – as your collection grows, these queries slow down proportionally.

To avoid full scans when querying URNs:

- **Always have an Index for URN Lookups**: If you are querying by URN (or URN prefix), ensure an index exists for that pattern. Without an index, any query on `urn` will be a COLLSCAN. The explain plan will literally show `"stage": "COLLSCAN"` and `totalDocsExamined` equal to the total number of documents examined. For example, an explain might say *`stage: 'COLLSCAN' ... nReturned: 3, totalDocsExamined: 10`* for a collection of 10 docs. That means it looked at all 10 docs to find 3 matches. Extrapolate that to 10 million docs, and you see the problem. An index on `urn` would change that to an index scan, significantly reducing examined docs.

-  ([Interpret Explain Plan Results - MongoDB Manual v8.0](https://www.mongodb.com/docs/manual/tutorial/analyze-query-plan/#:~:text=,indicate%20a%20collection%20scan)) ([Interpret Explain Plan Results - MongoDB Manual v8.0](https://www.mongodb.com/docs/manual/tutorial/analyze-query-plan/#:~:text=,is%20not%20using%20an%20index))

- **Use Selective Queries**: If you have a partial index or a compound index, structure your query to utilize it. For instance, if you created a partial index for `type: "file"` URNs, include `type: "file"` in the query so that the index can be used. If you query just by URN without the type, the planner might not use the partial index (because it would miss documents of other types). Similarly, if you have an index on `{ namespace: 1, resourceId: 1 }`, querying by both fields or at least the first field (`namespace`) will use the index, whereas querying only by `resourceId` would result in a full scan or at best a less efficient index usage. The key is: know your indexes and query in a way that leverages them.

- **Limit Fields in Large Text Search**: If you use `$text` or regex queries that could match many documents, consider adding additional filters to narrow the scan. For example, if you search `{$text: {$search: "project"}}` on a huge collection, it might match a lot. If you know you're only interested in a certain subset (say type "file"), add that filter: `{ type: "file", $text: { $search: "project" } }`. This way, MongoDB can first use the text index, then intersect with the type filter (or vice versa), which is more efficient than scanning all text matches across types you don't care about.

Remember that **collection scans are the enemy of performance** in big data. They *“indicate that the mongod had to scan the entire collection document by document... generally expensive and can result in slow queries.”*. By planning your indexes and queries, you can all but eliminate COLLSCANs for your routine operations.

### Measuring Query Performance with `explain()`

MongoDB provides the `explain()` method to analyze how a query is executed. It's an invaluable tool for tuning performance. After creating indexes, you should test your URN queries with `explain("executionStats")` to ensure they're using indexes as expected and to see how many documents/keys are being examined.

**How to use explain**: In the Mongo shell (or via drivers), you can do:
```js
db.resources.find({ urn: /^urn:app:file:2021:/ }).explain("executionStats")
```
This returns a detailed JSON of the query plan and execution statistics. Key fields to check:

- **`winningPlan`**: This shows the plan MongoDB chose. Look at the `"stage"` and if there's a `"inputStage"`. For an indexed query, you might see something like:
  ```js
  winningPlan: {
    stage: "FETCH",
    inputStage: {
      stage: "IXSCAN",
      indexName: "urn_1",
      keyPattern: { urn: 1 },
      ... index bounds info ...
    }
  }
  ```
  This indicates it used an index scan on `urn_1` index, and then a fetch to get the documents. If you see `stage: "COLLSCAN"` here, that's a warning sign (no index used).

- **`executionStats`**: This contains runtime metrics.
  - Check `totalKeysExamined` and `totalDocsExamined`. Ideally, for an index-supported URN query, `totalDocsExamined` should be close to the number of results returned (`nReturned`). For example, if you search by a unique URN, `totalDocsExamined` should be 1 (or very low). If you search by a prefix that matches 100 documents, maybe `totalDocsExamined` is 100 (and `totalKeysExamined` might be slightly above 100 due to how index scanning works). What you **don’t** want to see is `totalDocsExamined` in the thousands or millions for a query that only returns a few results – that means a lot of unnecessary scanning.
  - For instance, if our prefix query for 2021 files was efficient, we might see something like `totalKeysExamined: 2, totalDocsExamined: 2` and `nReturned: 2` (for two matching documents). If it was not using the index properly, we might see `totalKeysExamined: 0, totalDocsExamined: 5` (scanned 5 docs to return 2, in a small collection) or worse, in a big collection, `totalDocsExamined: 1000000` to return 2.

- **Index Bounds**: In the explain, under the IXSCAN stage, there is often a `keyPattern` and `indexBounds`. For our regex example, it might show something like:
  ```js
  indexBounds: { 
      urn: [ "[\"urn:app:file:2021:\", \"urn:app:file:2022:\")" ] 
  }
  ```
  This indicates it is scanning the index from `"urn:app:file:2021:"` inclusive up to `"urn:app:file:2022:"` exclusive – effectively the range of URNs starting with the 2021 prefix. This kind of detail confirms that the regex was optimized into an index range. If you saw indexBounds as `"[MinKey, MaxKey]"` that means it's scanning the whole index (like for an unanchored regex).

Using `explain()` during development and testing can validate that your indexes are being used. It’s also useful in production if you encounter a slow query – you can run an explain on the same filter to see if maybe an index is missing or the query is not using the intended index (sometimes the optimizer might choose a different index if multiple are available, not always correctly). 

As the MongoDB docs highlight, `explain("executionStats")` *“provide statistics about the performance of a query... useful in measuring if and how a query uses an index.”*. If a query is not using an index when you expect it to, you can adjust by adding hints, creating a better index, or rewriting the query.

**Using the Profiler**: Another tool beyond explain is the MongoDB database profiler, which can log slow queries (including details of scans and indexes). This is more of a monitoring tool, but for a focused analysis, `explain()` is usually enough to spot inefficient URN queries.

### Best Practices for URN Indexes in Large Collections

When your MongoDB collections grow large (millions of documents or more), the way you index and query URNs becomes even more important. Here are some best practices and considerations:

- **High Cardinality Advantage**: URNs typically have high cardinality (almost every document has a distinct URN). This is good for indexing because queries on such fields are very selective. An index on a high-cardinality field like a URN or UUID is very efficient, as lookups narrow down to few results quickly. Always index high-cardinality fields that you search by. The MongoDB documentation notes that indexes are less useful on low-cardinality fields (like boolean flags with only “true/false” values), but our URN case is the opposite – lots of unique values – which is ideal.

- **Unique Index for Data Integrity**: If appropriate, enforce a unique index on URNs (we discussed this in indexing section). This not only prevents duplicates, but for large data sets, it ensures that queries by URN return at most one document which can simplify application logic. In a sharded cluster, you might even use the URN as the shard key if it’s frequently used to locate documents (though be mindful of shard key design to avoid imbalances).

- **Index Size and Memory**: Understand that indexes consume memory. For a large collection with long URN strings, the index on `urn` could be sizable. Monitor your index sizes (`db.collection.stats()` will show index sizes). Using a partial index can reduce that size if you really don’t need to index all documents. But generally, if every document has a URN and you query any of them, you need them all indexed. In that case, ensure your working set (indexes) fits in RAM, or at least that the portion of the index you're querying can be loaded into RAM. If not, queries might hit disk which slows things down.

- **Compound Index Choices**: On a large collection, you want to minimize the number of separate indexes because each index adds overhead on writes. Instead of having separate indexes for `namespace`, `year`, `project` plus the URN, consider combining them if queries often use them together. For example, an index on `{ namespace: 1, year: 1, project: 1, urn: 1 }` could serve many queries (prefix queries on namespace, namespace+year, etc., and exact on full combination). However, be cautious: an index that’s too large (many fields) might not be fully utilized if not all those fields are queried. Sometimes multiple smaller indexes are better. It comes down to query patterns. Use the ESR rule (Equality, Sort, Range) for compound index ordering, if you have range queries on some fields and equality on others.

- **Avoid Over-Indexing**: Every index speeds up reads but slows down writes (inserts/updates/deletes) because the index must be updated too. If URNs are frequently updated (which is uncommon – usually an ID doesn't change), then the index overhead is something to consider. Most often URNs are static. But the main point is, don’t create more indexes than necessary. For example, do not create one index for each possible segment of the URN if you don't actually run queries solely on that segment. Index only those patterns that you know you will query. If you prematurely index every part, you pay a cost without a benefit. A lean indexing strategy will serve you better in the long run, and if new query needs arise, you can add indexes then.

- **Periodic Maintenance**: Over a very long time, if a lot of documents are added and removed, indexes can become fragmented. It’s less of an issue with WiredTiger (the default storage engine) than it was with MMAPv1, but still, keep an eye on index health. Running `compact` or `indexStats` can give insight if needed. For most cases, this is not a big concern.

- **Sharding Consideration**: If your collection is sharded, the shard key selection matters for performance. If URNs are guaranteed unique and you frequently look up by URN, using URN (or a prefix of it) as a shard key could ensure that queries by URN only target one shard. However, URNs might not have a good inherent prefix for range-based sharding (they could be quite random if they include random IDs or UUIDs). You might use hashed shard key on URN for even distribution. Just remember that with sharding, an index on the shard key exists by default, and any query that includes the shard key can be routed to the correct shard. If you shard by some other key (say `type` or `namespace`), a query by URN alone might be a scatter-gather (go to all shards). In a large cluster, that's something to think about.

- **Avoid $expr on Large Collections**: As already stated, `$expr` on a large collection will kill performance. On a small collection, it’s fine. On millions of documents, it’s effectively a full scan with computation. If you ever have to use $expr for something like matching a URN pattern that indexes can’t handle, consider using an aggregation pipeline and maybe `$redact` or something to filter – at least you can then $limit or do it in batches. But really, it's better to design around it.

- **Testing at Scale**: It’s a best practice to test your queries with a dataset size and distribution similar to production. URN patterns might behave differently as data grows. For example, an index range scan on prefix "urn:app:file:2021:" might be super fast when 2021 only has 5 records, but if in five years you accumulate 5 million records with that prefix, the same query scans a lot more keys. Still likely fine, but just be aware that the performance of prefix queries depends on how many entries share that prefix. If one prefix becomes extremely common, that query becomes a range scan over a large portion of the index (which is still better than a full collection scan, but could be slower than desired). If needed, you could break that out into a separate collection or use more specific indexing if a segment has skewed distribution.

To sum up, the key performance optimizations for URNs in MongoDB are: **use indexes effectively, avoid full scans, and continually use tools like explain() to verify that each query is doing what you expect (index scans, not collection scans)**. Design your schema such that queries can be simple and use direct indexes (denormalize segments if necessary). By following these practices, even very large MongoDB collections can handle URN-based lookups and searches efficiently.

## Step-by-Step Examples

Let's put all this theory into practice with a series of step-by-step examples. We'll demonstrate using MongoDB's native Node.js driver (no ODM/ORM like Mongoose) for database operations. The examples will cover inserting documents with URNs, creating indexes, and performing queries (exact and partial) efficiently. You can follow along using the Mongo shell or any MongoDB driver – the concepts are the same. (These examples assume MongoDB 4.x or newer, which support partial and wildcard indexes, etc.)

**Setup:** First, ensure you have a running MongoDB server (e.g., on localhost at the default port 27017). We'll use a database named `"test"` and a collection named `"resources"`.

1. **Insert Sample Documents** – We'll create a few documents with URN fields to work with:
   ```javascript
   const { MongoClient } = require('mongodb');
   async function run() {
     const uri = "mongodb://localhost:27017";
     const client = new MongoClient(uri);
     await client.connect();
     const db = client.db("test");
     const collection = db.collection("resources");
     
     // Insert documents with URNs and other fields
     await collection.insertMany([
       { name: "Alice", type: "user", urn: "urn:app:user:1001" },
       { name: "Bob", type: "user", urn: "urn:app:user:1002" },
       { name: "Project A Report", type: "file", year: 2021, urn: "urn:app:file:2021:projectA:report" },
       { name: "Project B Report", type: "file", year: 2021, urn: "urn:app:file:2021:projectB:report" },
       { name: "Project C Report", type: "file", year: 2022, urn: "urn:app:file:2022:projectC:report" }
     ]);
     console.log("Documents inserted:", await collection.countDocuments());
   }
   run().catch(console.dir);
   ```
   Here we inserted five documents:
   - Two user documents with URNs like `urn:app:user:<ID>`.
   - Three file documents with URNs encoding year and project info (for example, Project A Report has URN ending in `2021:projectA:report`). We also included a separate `year` field for file documents, to illustrate how storing a segment separately can help.
   
   Running this script (or equivalent commands in a shell) will connect to MongoDB, insert the documents, and print the total count. At this point, if we query the collection with no indexes, any search by `urn` will result in a collection scan. We'll address that next by creating indexes.

2. **Create Indexes for URN and Related Queries** – Now let's create some indexes to optimize queries on these documents:
   ```javascript
   // Create a single-field index on "urn"
   await collection.createIndex({ urn: 1 }, { unique: true });
   console.log("Index on urn created (unique).");
   
   // Create a compound index on (type, urn)
   await collection.createIndex({ type: 1, urn: 1 });
   console.log("Compound index on type+urn created.");
   
   // Create an index on the year field (for file documents)
   await collection.createIndex({ year: 1 });
   console.log("Index on year created.");
   ```
   We created three indexes:
   - `{ urn: 1 }` with `unique: true` – this enforces unique URNs and will speed up any query on the exact URN. Each URN value is now indexed.
   - `{ type: 1, urn: 1 }` – this will be used if we query within a type. For example, if we search for a URN but also specify `type: "file"`, MongoDB can use this index to first narrow by type then URN. It’s also useful for queries like "give me all URNs of type file" (prefix scan on type).
   - `{ year: 1 }` – this index will speed up queries by the `year` field (we might use this for finding all files from year 2021, for instance). We didn't create a compound index of (type, year) here, but that could be done as well. Since our `year` usage will always be in context of `type: "file"`, a compound index on `{type:1, year:1}` would actually be even better. For simplicity, we did a single-field index on year.

   *Using Partial Index (optional):* As an alternative, we could index `urn` only for file documents using a partial index:
   ```javascript
   // (Optional) Create a partial index on urn for file type only
   await collection.createIndex(
     { urn: 1 },
     { unique: true, partialFilterExpression: { type: "file" } }
   );
   ```
   This would index URNs for `type: "file"` documents and enforce uniqueness among those. It saves space by not indexing user URNs (since maybe we rarely query users by URN in this hypothetical scenario). However, note that if we did need to query user URNs, this index would not help. In practice, we already created a full index on `urn`, so we won't actually run this partial index here. It's just shown as an example of how you **would** create one if needed (unique + partial index in one go). According to MongoDB docs, partial indexes give you control to index a subset of documents and thus *“only include documents that will be accessed through the index”* to reduce overhead.

   *Using Wildcard Index (optional):* If we had URNs in various fields or wanted a catch-all, we could do:
   ```javascript
   // (Optional) Wildcard index on all fields (not usually needed for URNs)
   await collection.createIndex({ "$**": 1 });
   ```
   But as discussed, this is not necessary for our scenario and would just add overhead. We skip this in practice.

3. **Querying by URN (Exact Match)** – With the index on `urn` in place, let's retrieve a specific document by its URN:
   ```javascript
   // Find a document by exact URN
   const queryUrn = "urn:app:user:1001";
   let doc = await collection.findOne({ urn: queryUrn });
   console.log("Lookup by URN:", doc);
   ```
   We expect this to return Alice's document. Internally, MongoDB will use the `urn_1` index to fetch this quickly. This is an exact match query using the index – very efficient (no full scan needed).

   **Output:** The console should show something like:
   ```
   Lookup by URN: { _id: ObjectId("..."), name: 'Alice', type: 'user', urn: 'urn:app:user:1001' }
   ```
   (Plus any other fields if present; here we only have those fields for Alice.)

4. **Querying by URN Prefix (Regex)** – Now, let's use a regex to get all files from year 2021. We'll use a regex anchored at `^`:
   ```javascript
   // Find all file URNs from year 2021 using regex prefix
   const prefixRegex = /^urn:app:file:2021:/;
   let cursor = collection.find({ urn: { $regex: prefixRegex } });
   let results = await cursor.toArray();
   console.log("All 2021 files (regex):", results.map(doc => doc.urn));
   ```
   The regex `^urn:app:file:2021:` will match URNs that start with that sequence. In our data, "Project A Report" and "Project B Report" fit that pattern. The index on `urn` will be utilized for this query because the regex has a fixed prefix. We should get those two documents in the result. 

   **Output:** Something like:
   ```
   All 2021 files (regex): [ 'urn:app:file:2021:projectA:report', 'urn:app:file:2021:projectB:report' ]
   ```
   The order might depend on the index order; in ascending order, projectA comes before projectB as strings.

   Under the hood, the database did an index range scan on `urn` from `"urn:app:file:2021:"` up to `"urn:app:file:2022:"` (not inclusive). Only those index entries were scanned, not the whole index.

5. **Querying by URN Segments (Separate Fields)** – Next, we try retrieving documents by using the separate `year` field rather than regex on URN:
   ```javascript
   // Find all file documents from year 2021 using the year field
   results = await collection.find({ type: "file", year: 2021 }).toArray();
   console.log("All 2021 files (fields):", results.map(doc => doc.urn));
   ```
   Here, we query by `type` and `year`. We have an index on `type, urn` and an index on `year`. The query includes both. MongoDB might use an index intersection of `type_1_urn_1` and `year_1`, or it might choose one of them (likely the `year_1` index, since year=2021 is selective, and then filter type which is a small set). If we had a compound index on `{ type:1, year:1 }`, that would be ideal for this query. Nonetheless, this query is still efficient because the `year` index narrows down to just the 2021 entries (Project A and B reports) and then the type filter is applied to those (they are files anyway). In any case, it's certainly not scanning the whole collection.

   **Output:** 
   ```
   All 2021 files (fields): [ 'urn:app:file:2021:projectA:report', 'urn:app:file:2021:projectB:report' ]
   ```
   This should match the previous result. We demonstrate that using structured fields can achieve the same result as the regex, often with equal or better performance (especially as data grows, an equality query on an indexed field is typically faster than even an index-backed regex).

6. **Text Search on URN** – To show how text search works, let's do a text index on `urn` and search for a token:
   ```javascript
   // Create a text index on urn (if not already created)
   await collection.createIndex({ urn: "text" });
   // Search URNs containing 'projectB'
   results = await collection.find({ $text: { $search: "projectB" } }).toArray();
   console.log("Text search for 'projectB':", results.map(doc => doc.urn));
   ```
   When creating a text index, make sure no other text index exists (only one allowed per collection). In our case, we didn't have one yet. The text search for "projectB" should return the Project B Report document, because its URN contains "projectB". The text index lookup is very fast; it will directly find the term "projectb" (lowercased) in the index and retrieve the matching doc. 

   **Output:**
   ```
   Text search for 'projectB': [ 'urn:app:file:2021:projectB:report' ]
   ```
   This confirms our text index can find URNs by an internal segment. If we searched "project", it might return both A and B since both URNs contain tokens starting with "project".

   *Note:* Text indexes might return results in a relevance order. If multiple docs match, you might need to sort by something (or use `$text: {$search: "term", $caseSensitive: true}` if you want case-sensitive match, etc.). For our simple case, it's straightforward.

7. **Explain Query Performance** – Finally, let's use `explain()` to verify that our regex query is optimized by the index:
   ```javascript
   const explained = await collection.find({ urn: { $regex: prefixRegex } })
                                    .explain("executionStats");
   console.log("Explain - regex prefix query:");
   console.log("Stage:", explained.queryPlanner.winningPlan.stage, 
               "->", explained.queryPlanner.winningPlan.inputStage.stage);
   console.log("Keys examined:", explained.executionStats.totalKeysExamined);
   console.log("Docs examined:", explained.executionStats.totalDocsExamined);
   console.log("URNs found:", explained.executionStats.nReturned);
   ```
   We call `explain("executionStats")` on the same query that finds 2021 files by regex. The output will tell us how many index keys and documents were scanned and what stages were used. We expect to see an index scan stage.

   **Output (formatted for clarity):**
   ```
   Explain - regex prefix query:
   Stage: FETCH -> IXSCAN
   Keys examined: 2
   Docs examined: 2
   URNs found: 2
   ```
   This indicates the query planner used an index scan (`IXSCAN`) within a fetch. It examined 2 index keys and 2 documents to return 2 results. That matches our expectation – it only scanned the index entries for "2021:projectA:report" and "2021:projectB:report", and then fetched those docs. It did not scan any other keys or docs. If this query had to scan the whole collection or index, `totalKeysExamined` would be 5 (the number of docs) or similar. Seeing it as 2 confirms it was efficient. The `winningPlan.stage: FETCH` with an `inputStage.stage: IXSCAN` shows that an index was used. A COLLSCAN would have shown up directly as the winning plan stage.

   (If you run this yourself, the exact numbers might differ if the index picks up keys in a slightly different order, but it should be minimal. In our small set, it's obvious. In a larger set, you would look at the magnitude of Keys Examined vs. total docs.)

8. **Cleanup** – After the demonstration, you can drop the collection or close the client:
   ```javascript
   // (Cleanup) Close the DB connection
   await client.close();
   ```
   This ensures the Node.js script exits. In a real application, you'd keep the client for reuse rather than close immediately after these operations.

These examples show how to insert URNs and then leverage indexes and queries to retrieve data efficiently. We saw exact match, prefix (regex) match, and using separate fields or text index for internal matches. In each case, an appropriate index made the query fast. Using `explain()` helped confirm that our queries are doing indexed scans rather than full scans.

## Conclusion and Best Practices

In this article, we introduced URNs and their usefulness as unique identifiers in MongoDB, and we explored various techniques to store and query URNs efficiently. Here are the key takeaways and best practices to remember:

- **Index your URN field**: If your application queries by URN (which is usually the case if you're storing them), always ensure there's an index on the URN field. This turns expensive full collection scans into fast index lookups. Without an index, searching by URN will scan the entire collection, which *“is a generally expensive operation and can result in slow queries”* on large datasets.
- **Use appropriate index types**: A single-field index on `urn` is sufficient for exact matches. If you often query by URN plus another field (like `type` or `namespace`), consider a compound index to cover those patterns. This can even allow covered queries (index-only results) to optimize performance. For example, an index on `{type:1, urn:1}` helps when filtering by type as well as URN.
- **Leverage high cardinality**: URNs are typically unique per document, which is high-cardinality. Indexes on such fields are very effective. You can also enforce uniqueness with a unique index to ensure data integrity (no duplicate URNs). This also helps the query optimizer, since it knows a unique index search will return at most one document.
- **Partial indexes for special cases**: If only a subset of your data will ever be queried by URN (for example, only documents of a certain category), a partial index can reduce index size and write overhead by indexing just those. Just be sure your queries include the partial filter or else the index won’t be used. Partial indexes are a great way to optimize when you have heterogeneous data – you index what you need and skip what you don’t.
- **Avoid over-indexing and use wildcard indexes sparingly**: Don’t create unnecessary indexes. Each extra index slows down writes and consumes memory. Stick to indexes that map to real query needs. Wildcard indexes (`$**`) are powerful but should only be used when you truly have dynamic or unknown fields to query . For a known field like `urn`, a normal index outperforms a wildcard index in both speed and size. Wildcard indexes also omit certain fields by default (e.g., `_id`) and can't cover text search unless you use a wildcard text index, so use them only in niche cases.
- **Query patterns matter**: For exact lookups, just use `{ urn: "value" }` – MongoDB will handle it via the index. For partial searches:
  - Use anchored regex (`^...`) for prefix searches so the index can be used.
  - Avoid unanchored regex or leading wildcards, which force a full index scan or collection scan .
  - If you need to search by an internal part of the URN frequently, consider storing that part in its own field (and index it) to query directly by equality. This denormalization trades a bit of storage for a lot of query speed.
  - Alternatively, use a text index for searching URN components, which is optimized for substring searches at the word/token level.
- **Be cautious with `$expr`**: The `$expr` operator allows complex queries (like computing on the URN string), but it **cannot use indexes in most cases** and will evaluate the condition for each document. This can be as bad as a full collection scan. **Avoid using $expr for URN filtering** on large collections. Instead, try to achieve the same logic with standard operators or pre-computed fields that *can* use indexes.
- **Monitor query performance**: Use `explain()` to ensure your queries use indexes as intended. Look for `IXSCAN` vs `COLLSCAN`, and check how many documents are examined versus returned. A well-indexed URN query will examine very few documents (ideally equal to the number returned). For example, an explain showing `totalDocsExamined` equal to the collection size is a sign something is wrong (index missing or not being used). Aim for queries where indexes do the heavy lifting – e.g., an anchored regex query will show a small fraction of index keys examined thanks to the prefix optimization.
- **Plan for scale**: In a small dev dataset, it might not matter if you do a regex search or a full scan. But as data grows, these decisions become critical. Always assume your data will grow and design your indexing strategy accordingly. If using URNs as keys, it's common that the dataset can become large, so these optimizations pay off.
- **Common pitfalls to avoid**:
  - Not indexing the URN field at all (leading to dreadful query performance).
  - Using regex patterns that negate index usage (like `/.*something/`) in a production query.
  - Relying on `$expr` for something that could be achieved with a normal indexed field.
  - Creating too many indexes “just in case” (hurting write performance and using RAM) – stick to what you need.
  - Forgetting to use unique index if duplicates would cause problems in your app (this is more about data correctness than performance, but still important).
  - Not testing queries with explain or ignoring slow query logs – you might not realize a query is doing a full scan until it's a problem. It's easier to catch and fix it early.

- **Use URNs consistently**: This is more of a data design note. URNs should be stored in a consistent format. If some URNs are lowercase and some uppercase, searches might miss matches unless handled. It might be worth normalizing URNs (like storing all in lowercase if the scheme allows case-insensitivity) so that queries don't have to account for case variants. Consistency also helps if you use text search (so tokens match) and ensures your indexes aren't duplicating entries for what should be the same logical resource.

By following these best practices, you can effectively harness the power of URNs for identifying resources in your MongoDB application without sacrificing performance. URNs give you a lot of flexibility in referencing data, and MongoDB's indexing capabilities – single, compound, partial, text, etc. – provide the tools to query those URNs efficiently. Always align your indexing strategy with your query patterns, and you'll keep your queries running fast even as your data grows.

