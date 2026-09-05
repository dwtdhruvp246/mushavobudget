-- Allow the public Contact page to insert enquiries directly with the
-- Supabase publishable/anonymous key. Public roles receive no read, update,
-- or delete access. This migration is safe to run after the enquiry-alignment
-- migration, including when its earlier Edge Function version was deployed.

begin;

alter table public.enquiries enable row level security;

drop policy if exists "Public can submit enquiries" on public.enquiries;
create policy "Public can submit enquiries" on public.enquiries
for insert to anon, authenticated
with check (
  status = 'new'
  and source = 'website'
  and handled_by is null
  and handled_at is null
  and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  and country_code = any (string_to_array('AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW', ' '))
);

revoke select, insert, update, delete on public.enquiries from anon;
revoke insert, delete on public.enquiries from authenticated;
grant insert (full_name, email, country_name, country_code, enquiry_type, message)
on public.enquiries to anon, authenticated;

commit;
