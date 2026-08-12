from pathlib import Path
import re

p = Path("prisma/schema.prisma")
t = p.read_text(encoding="utf-8")
t2 = t.replace('  schemas  = ["public", "mateo_support"]\n', "")
t2 = re.sub(r'\n\n  @@schema\("public"\)', "", t2)
t2 = re.sub(r'\n\n  @@schema\("mateo_support"\)', "", t2)
p.write_text(t2, encoding="utf-8")
print("@@schema left:", t2.count("@@schema"))
print(t2[t2.find("datasource db") : t2.find("datasource db") + 80])
