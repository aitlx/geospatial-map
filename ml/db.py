import psycopg2

conn = psycopg2.connect(
    host="127.0.0.1", 
    port=5432,         
    database="geo_agri_db",
    user="postgres",
    password="Foracads28@"
)

print("Connected successfully")
