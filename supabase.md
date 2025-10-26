Session pooler
Shared Pooler
Only recommended as an alternative to Direct Connection, when connecting via an IPv4 network.

postgresql://postgres.sxacpyiyanypgmscpjuf:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres


Transaction pooler
Shared Pooler
Ideal for stateless applications like serverless functions where each interaction with Postgres is brief and isolated.

postgresql://postgres.sxacpyiyanypgmscpjuf:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres


Direct connection
Ideal for applications with persistent and long-lived connections, such as those running on virtual machines or long-standing containers.

postgresql://postgres:[YOUR_PASSWORD]@db.sxacpyiyanypgmscpjuf.supabase.co:5432/postgres