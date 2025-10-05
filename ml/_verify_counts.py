import psycopg2

conn = psycopg2.connect(host='127.0.0.1', port=5432, database='geo_agri_db', user='postgres', password='Foracads28@')
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM barangay_yields WHERE status='approved'")
print('approved_yields', cur.fetchone()[0])
cur.execute("SELECT COUNT(*) FROM barangay_crop_prices WHERE status='approved'")
print('approved_prices', cur.fetchone()[0])
cur.execute("SELECT COUNT(*) FROM approvals WHERE reason='mock-data seed'")
print('approvals_seeded', cur.fetchone()[0])
cur.execute("SELECT record_type, COUNT(*) FROM approvals WHERE reason='mock-data seed' GROUP BY record_type ORDER BY record_type")
print('approvals_by_type', cur.fetchall())
cur.close()
conn.close()
