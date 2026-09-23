# datashield-demo-api
# DataShield

A Java library that automatically injects security filters into SQL queries.

---

## The Problem

The problem is simple: developers forget. One missing WHERE clause, and Customer A can see Customer B's data. (it's me )

This is not just a bug. It is a serious security issue. It can lead to:

Data leaks between customers

Violation of privacy laws (GDPR, HIPAA, SOC2)

Legal problems and fines

Loss of customer trust

Existing solutions have limits:

Hibernate @Filter does not cover JOINs, UPDATE, or DELETE.

Oracle VPD / Postgres RLS are powerful, but locked to one database. They also need a DBA to configure.

Manual filters in every repository method are error-prone.

## The Idea
DataShield sits between your application and the database. It reads every SQL query, understands its structure, and adds the tenant filter automatically.

You write:

sql
SELECT * FROM orders WHERE total > 100;
The library changes it to:

sql
SELECT * FROM orders WHERE (total > 100) AND tenant_id = 'TENANT_A';
You do not change your code. The library works at the JDBC level.

## How It Works
The library uses two tools:

ByteBuddy — to intercept JDBC calls (Statement and PreparedStatement).

JSqlParser — to parse SQL and modify its structure.

The process:

Your application sends a query.

The library captures the query before it reaches the database.

The query is parsed into an Abstract Syntax Tree (AST).

The tenant filter is added to the correct place.

The AST is converted back to SQL.

The database receives the safe query.

## Supported Query Types
The library currently supports SELECT queries in many forms:

###  Simple SELECT
sql
-- Input
SELECT * FROM users;

** Output **
SELECT * FROM users WHERE tenant_id = 'TENANT_A';
SELECT with WHERE
sql
-- Input
SELECT * FROM orders WHERE total > 100;

** Output **
SELECT * FROM orders WHERE (total > 100) AND tenant_id = 'TENANT_A';
SELECT with OR (Important)
If we simply append AND tenant_id = ... to a query with OR, we create a security hole. Consider:

sql
-- Input
SELECT * FROM orders WHERE status = 'PENDING' OR status = 'SHIPPED';
If we append the filter at the end, the database reads:

sql
WHERE status = 'PENDING' OR (status = 'SHIPPED' AND tenant_id = 'A');
This means every PENDING order from every tenant is leaked, because AND has higher priority than OR.

The library solves this by wrapping the original WHERE clause in parentheses:

sql
** Output **
SELECT * FROM orders WHERE (status = 'PENDING' OR status = 'SHIPPED') AND tenant_id = 'TENANT_A';
Now the filter applies to the whole condition.

SELECT with JOIN
sql
-- Input
SELECT o.* FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.total > 100;

** Output **
SELECT o.* FROM orders o JOIN customers c ON o.customer_id = c.id 
WHERE (o.total > 100) AND tenant_id = 'TENANT_A';
SELECT with Subquery (IN)
sql
-- Input
SELECT * FROM orders 
WHERE customer_id IN (SELECT id FROM customers WHERE level = 'GOLD');

** Output **
SELECT * FROM orders 
WHERE customer_id IN (SELECT id FROM customers WHERE level = 'GOLD' AND tenant_id = 'TENANT_A') 
AND tenant_id = 'TENANT_A';
The filter is added inside the subquery and outside it.

### SELECT with Subquery (EXISTS)
sql
-- Input
SELECT * FROM orders o 
WHERE EXISTS (SELECT 1 FROM customers c WHERE c.id = o.customer_id);

** Output **
SELECT * FROM orders o 
WHERE EXISTS (SELECT 1 FROM customers c WHERE c.id = o.customer_id AND tenant_id = 'TENANT_A') 
AND tenant_id = 'TENANT_A';
SELECT with Subquery (NOT EXISTS, NOT IN)
Both NOT EXISTS and NOT IN are supported. The subquery is modified correctly.

### SELECT with Comparison Subquery
sql
-- Input
SELECT * FROM orders WHERE total > (SELECT AVG(total) FROM orders);

** Output **
SELECT * FROM orders 
WHERE (total > (SELECT AVG(total) FROM orders WHERE tenant_id = 'TENANT_A')) 
AND tenant_id = 'TENANT_A';
SELECT with UNION / INTERSECT / EXCEPT
sql
-- Input
SELECT name FROM users WHERE age > 18
UNION
SELECT name FROM users WHERE age < 5;

** Output **
SELECT name FROM users WHERE (age > 18) AND tenant_id = 'TENANT_A'
UNION
SELECT name FROM users WHERE (age < 5) AND tenant_id = 'TENANT_A';
Each part of the UNION is modified independently.

### SELECT with BETWEEN
sql
-- Input
SELECT * FROM orders WHERE total BETWEEN 100 AND 500;

** Output **
SELECT * FROM orders WHERE (total BETWEEN 100 AND 500) AND tenant_id = 'TENANT_A';
SELECT with LIKE
sql
-- Input
SELECT * FROM orders WHERE product_name LIKE '%Phone%';

** Output **
SELECT * FROM orders WHERE (product_name LIKE '%Phone%') AND tenant_id = 'TENANT_A';
PreparedStatement
The library also intercepts Connection.prepareStatement(sql). The SQL is modified before the parameters are bound. This keeps the parameter order correct.

## java
PreparedStatement ps = conn.prepareStatement("SELECT * FROM users WHERE name = ?");
ps.setString(1, "Ahmed");
// The library modifies the SQL before this point.

## Configuration
Excluding Specific Tables
In some cases, you may want a table to be free of the tenant filter. For example:

Global configuration tables

Shared reference data

Audit tables

The library will support a configuration file to list tables that should not be modified:

properties
datashield.exclude.tables=countries,currencies,audit_log
When a query touches an excluded table, the filter is not added.

This feature is planned. It is not implemented yet.

## Planned Features
The library is in early development. The following features are planned:

### Write Operations
Currently, only SELECT queries are modified. The following commands will be supported in future releases:

UPDATE — to prevent mass updates across tenants.

sql
UPDATE orders SET status = 'DONE';   -- dangerous!
Will become:

sql
UPDATE orders SET status = 'DONE' WHERE tenant_id = 'TENANT_A';
DELETE — to prevent mass deletes across tenants.

sql
DELETE FROM orders;   -- dangerous!
Will become:

sql
DELETE FROM orders WHERE tenant_id = 'TENANT_A';
INSERT — to enforce that every new row belongs to the correct tenant.

sql
INSERT INTO orders (id, total) VALUES (1, 500);   -- missing tenant_id
Will become:

sql
INSERT INTO orders (id, total, tenant_id) VALUES (1, 500, 'TENANT_A');
Configuration
Exclude specific tables from filtering.

Support different column names (not only tenant_id).

Support multiple tenant columns per table.

### Performance
Caffeine cache for parsed SQL queries.

Faster path for repetitive queries.

### Observability
Audit logging for every modified query.

### Metrics (query count, filtered count, errors).

### Control Plane
A dashboard to manage policies.

Real-time monitoring of tenant traffic.

### AI Optimizer
A Python service that uses LLMs to rewrite complex queries for performance.

## Limitations
Only SELECT queries are supported for now.

Complex Common Table Expressions (CTEs / WITH clauses) are not fully tested.

Tested with H2 and MySQL only.

No configuration UI yet.