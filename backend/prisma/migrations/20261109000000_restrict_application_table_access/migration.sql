BEGIN;

-- Application data goes through Express and Prisma. Browser roles use Supabase Auth only.
REVOKE ALL PRIVILEGES ON TABLE
    public."User", public."Conversation", public."Message", public._prisma_migrations
    FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public."Message_id_seq"
    FROM PUBLIC, anon, authenticated;

-- Keep browser access closed even if a table grant is added later.
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;

COMMIT;
