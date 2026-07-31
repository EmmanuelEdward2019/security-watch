-- =============================================================================
-- 008 — CONTENT SEED
-- =============================================================================
-- Moves the editorial content that was hardcoded in BlogPage.tsx and
-- BlogPostPage.tsx into `blog_posts`, so publishing no longer requires a code
-- change and a deploy. The copy is carried over unchanged.
--
-- Safe to re-run: every insert is keyed on the slug.
-- =============================================================================

INSERT INTO public.blog_posts
  (slug, title, excerpt, body, category, tags, read_minutes, status, published_at, author_name)
VALUES
  (
    'avoid-land-scams',
    'How to Identify and Avoid Land Fraud in Nigeria',
    'Red flags to watch for, and the steps to verify ownership before any money changes hands.',
    'Land fraud remains one of the most prevalent financial crimes in Nigeria. Key warning signs include pricing significantly below market value, sellers unwilling to submit to independent verification, and undue pressure to complete payment before documentation is reviewed.

To mitigate risk, prospective buyers should always verify ownership through official land registry channels, insist on authenticated copies of survey plans and title documents, conduct a physical inspection of the property, and engage a professional verification service such as The Security Watch before committing any funds.

A verified badge on a listing means our team has cross-referenced the title against the registry and inspected the property. It is deliberately not something an owner can apply to their own listing.',
    'guides',
    ARRAY['property', 'fraud', 'due diligence'],
    4,
    'published',
    '2024-03-15T09:00:00Z',
    'The Security Watch'
  ),
  (
    'private-investigations',
    'How Private Investigations Work on Our Platform',
    'What happens after you file a case, and how you stay informed while it progresses.',
    'When a case is submitted through The Security Watch, it undergoes an initial review and is assigned to a qualified professional based on the nature of the matter and the relevant jurisdiction. Assignment is confirmed by an administrator, not automated — a person decides who gains access to a case file.

The assigned investigator examines all submitted evidence, conducts further enquiries as warranted, and works methodically toward resolution. All communications are handled through secure, confidential channels available only to the people assigned to the case.

Clients can monitor case progress in real time through their dashboard. Investigation timelines vary depending on complexity — ranging from days for straightforward enquiries to several weeks for more involved matters. Regular updates are provided at each milestone.

Every file you upload is fingerprinted with a SHA-256 hash at the moment it arrives, and that fingerprint is re-checked each time the file is opened. If the bytes ever changed, the platform would say so.',
    'guides',
    ARRAY['investigations', 'process', 'evidence'],
    5,
    'published',
    '2024-03-10T09:00:00Z',
    'The Security Watch'
  ),
  (
    'property-verification',
    'Understanding Our Property Verification Process',
    'What we check, what the verified badge means, and what it does not cover.',
    'The Security Watch conducts independent verification of property ownership by cross-referencing seller claims against official land registry records, examining title deeds, survey plans, and certificates of occupancy for authenticity, and confirming the absence of encumbrances or competing claims.

Properties that successfully pass our verification process receive a verified status badge, providing prospective buyers and tenants with an additional layer of confidence. That badge is granted by our team following a review — a landlord cannot set it on their own listing.

While verification significantly reduces the risk of fraud, it is recommended as one component of a comprehensive due diligence approach rather than a substitute for your own legal advice.',
    'guides',
    ARRAY['property', 'verification', 'trust'],
    4,
    'published',
    '2024-03-05T09:00:00Z',
    'The Security Watch'
  ),
  (
    'institutional-transparency',
    'The Importance of Institutional Transparency',
    'How independent, on-site evaluation raises the standard of public services.',
    'Independent oversight drives measurable improvement in institutional performance. The Security Watch deploys trained media agents to conduct anonymous, on-site evaluations of public and private institutions — assessing punctuality, facility maintenance, staff professionalism, and quality of service delivery.

The programme is designed to be constructive rather than punitive: institutions that demonstrate high standards receive public recognition and commendation, while those with identified deficiencies are provided with documented recommendations for improvement.

Every field report is reviewed by an administrator before it becomes public. Ratings are one per person per institution, and the overall score is computed by our systems from the five component measures rather than submitted by the rater — both safeguards exist so that a published ranking means something.

The broader objective is to raise the standard of public services for the benefit of all citizens.',
    'transparency',
    ARRAY['institutions', 'accountability', 'public services'],
    5,
    'published',
    '2024-02-28T09:00:00Z',
    'The Security Watch'
  )
ON CONFLICT (slug) DO NOTHING;
