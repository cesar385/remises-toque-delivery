import re, glob, os
base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
partes = []
for f in sorted(glob.glob(os.path.join(base, 'sql', '*.sql'))):
    s = open(f, encoding='utf-8').read()
    s = re.sub(r'(language plpgsql[^\n$]*?as \$\$)', r'\1\n#variable_conflict use_variable\n', s, flags=re.I)
    partes.append(f'-- ======== {os.path.basename(f)} ========\n' + s)
cab = ("-- Remises TOQUE! · Central de despacho — instalación completa para Supabase\n"
       "-- Pegá TODO este archivo en Supabase → SQL Editor → Run. Se puede volver a correr: no borra datos.\n\n")
open(os.path.join(base, 'supabase', 'rodar.sql'), 'w', encoding='utf-8').write(cab + '\n\n'.join(partes))
print('ok', sum(len(p) for p in partes))
