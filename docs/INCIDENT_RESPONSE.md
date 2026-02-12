# Incident Response Plan — PrimărIA

## 1. Scope

This plan covers security incidents, data breaches, and service disruptions affecting the PrimărIA local tax management platform. It applies to all environments (production, staging) and all tenant data.

## 2. Regulatory Framework

| Regulation | Requirement | Deadline |
|---|---|---|
| **GDPR Art. 33** | Notify ANSPDCP (National Data Protection Authority) of personal data breaches | **72 hours** from awareness |
| **GDPR Art. 34** | Notify affected data subjects if high risk to rights/freedoms | Without undue delay |
| **NIS2 Directive** | Notify DNSC (National Cyber Security Directorate) of significant incidents | **24 hours** early warning, **72 hours** full report |
| **Law 362/2018** (RO NIS transposition) | Report cyber incidents to CERT-RO | Per DNSC guidance |

## 3. Incident Classification

### Severity Levels

| Level | Description | Examples | Response Time |
|---|---|---|---|
| **P1 — Critical** | Data breach, full service outage, active exploitation | Database exfiltration, ransomware, RLS bypass | Immediate (< 1 hour) |
| **P2 — High** | Partial breach, degraded service, vulnerability exploited | Single tenant data leak, auth bypass, MinIO exposure | < 4 hours |
| **P3 — Medium** | Potential vulnerability, minor service issue | Failed brute-force, misconfiguration found, job queue failure | < 24 hours |
| **P4 — Low** | Informational, no immediate impact | Suspicious log entries, failed login spikes | Next business day |

## 4. Response Team

| Role | Responsibility |
|---|---|
| **Incident Commander** | Overall coordination, decision authority, regulatory communication |
| **Technical Lead** | Root cause analysis, containment, remediation |
| **DPO (Data Protection Officer)** | GDPR assessment, ANSPDCP notification, data subject communication |
| **Communications Lead** | Tenant notification, public communication (if needed) |

## 5. Response Procedure

### Phase 1: Detection & Triage (0–1 hour)

1. **Detect** — Alert from monitoring, audit log anomaly, user report, or automated scan.
2. **Classify** — Assign severity level (P1–P4).
3. **Assemble** — Notify response team members per severity.
4. **Document** — Open incident ticket with: timestamp, reporter, affected systems, initial assessment.

### Phase 2: Containment (1–4 hours)

1. **Isolate** — If active breach:
   - Revoke compromised credentials/sessions
   - Block offending IPs at infrastructure level
   - Disable affected tenant contexts if RLS bypass suspected
   - Take affected MinIO buckets offline if document exposure
2. **Preserve evidence** — Snapshot databases, export relevant audit logs, capture application logs.
3. **Assess scope** — Determine:
   - Which tenants are affected?
   - What data types are involved? (CNP, financial data, addresses)
   - Is data encrypted at rest? (CNP uses AES-256-GCM)
   - Timeline of unauthorized access

### Phase 3: Notification (within regulatory deadlines)

#### ANSPDCP (GDPR Art. 33) — within 72 hours
If personal data breach confirmed, submit to [ANSPDCP portal](https://www.dataprotection.ro/):
- Nature of the breach (categories of data, approximate number of data subjects)
- Contact details of DPO
- Likely consequences
- Measures taken/proposed

#### DNSC (NIS2) — early warning within 24 hours
If significant cyber incident:
- Submit early warning to DNSC within 24 hours
- Full incident report within 72 hours
- Final report within 1 month

#### Affected Tenants
- Notify municipality admins via authenticated in-app notification + email
- Provide: what happened, what data affected, what we're doing, what they should do

#### Affected Data Subjects (GDPR Art. 34)
If high risk to rights/freedoms (e.g., unencrypted CNP exposure):
- Tenant municipalities must notify their taxpayers
- Provide template notification for municipalities to use

### Phase 4: Eradication & Recovery

1. **Root cause** — Identify and fix the vulnerability:
   - Code fix (RLS policy, auth check, input validation)
   - Infrastructure fix (network rules, TLS config, MinIO ACLs)
   - Configuration fix (environment variables, secrets rotation)
2. **Credential rotation** — Rotate all potentially compromised:
   - Database passwords
   - MinIO access keys
   - Redis passwords
   - NextAuth secrets
   - Encryption keys (re-encrypt CNP data if key compromised)
3. **Verify fix** — Deploy fix to staging, run security tests, confirm resolution.
4. **Restore service** — Deploy to production, monitor closely for 48 hours.

### Phase 5: Post-Incident Review (within 2 weeks)

1. **Timeline reconstruction** — Complete incident timeline.
2. **Root cause analysis** — Document technical root cause.
3. **Lessons learned** — What worked, what didn't, what to improve.
4. **Action items** — Specific improvements with owners and deadlines.
5. **Report** — Publish internal post-mortem document.

## 6. Data-Specific Considerations

### CNP (Personal Identification Number)
- Stored encrypted with AES-256-GCM
- Lookup via SHA-256 hash (not reversible without key)
- If encryption key compromised: re-encrypt all CNP data with new key
- CNP breach = high risk to data subjects (mandatory Art. 34 notification)

### Financial Data (tax assessments, payments)
- Protected by Row-Level Security (tenant isolation)
- If RLS bypassed: cross-tenant data exposure possible
- Verify all tenant isolation boundaries

### Documents (PDFs in MinIO)
- Contains taxpayer names, addresses, tax amounts
- Stored with tenant-scoped paths
- If MinIO bucket exposed: revoke all pre-signed URLs, rotate access keys

## 7. Contact Directory

| Entity | Contact | When |
|---|---|---|
| ANSPDCP | https://www.dataprotection.ro/ | Personal data breach (72h) |
| DNSC / CERT-RO | https://dnsc.ro/raportare-incident | Cyber security incident (24h) |
| Hosting Provider | Per contract | Infrastructure incidents |
| DPO | [designated DPO contact] | All personal data incidents |

## 8. Testing

- **Tabletop exercise**: Quarterly simulation of P1/P2 scenarios
- **Notification drill**: Annual test of ANSPDCP notification process
- **Audit log review**: Monthly review of authentication and access anomalies
- **Backup restoration test**: Quarterly verification of database backup integrity

## 9. Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-02-12 | Phase 3 Build | Initial version |
