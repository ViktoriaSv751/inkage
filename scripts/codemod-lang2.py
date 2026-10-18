import re, os
files=[]
for d in ['app','lib']:
    for dp,dn,fn in os.walk(d):
        for f in fn:
            if f.endswith(('.ts','.tsx')) and 'locales' not in dp: files.append(os.path.join(dp,f))
S=r"('(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)"
for p in files:
    if p in ('lib/tr.ts','lib/i18n.ts'): continue
    s=open(p).read(); o=s
    s=re.sub(r"\(en: string, (hu|h)\) => \((lang|L|ui\.lang) === 'hu' \? \1 : en\)", lambda m: f"(en: string, {m.group(1)}) => tx({m.group(2)}, en, {m.group(1)})", s)
    s=re.sub(r"\(langOf\(searchParams\)\) === 'hu' \? "+S+" : "+S, lambda m: f"tx(langOf(searchParams), {m.group(3)}, {m.group(2)})", s)
    s=re.sub(r"langOf\(searchParams\) === 'hu' \? "+S+" : "+S, lambda m: f"tx(langOf(searchParams), {m.group(2)}, {m.group(1)})", s)
    s=re.sub(r"\b(L|lang) === 'hu'\s*\?\s*"+S+r"\s*:\s*"+S, lambda m: f"tx({m.group(1)}, {m.group(3)}, {m.group(2)})", s)
    # obj[lang] on {en,hu} content
    s=re.sub(r"\b([A-Za-z_][\w]*(?:\.[A-Za-z_]\w*)*)\[(lang|L|ui\.lang)\]", lambda m: f"pick({m.group(1)}, {m.group(2)})", s)
    s=re.sub(r"^(export )?type Lang = 'en' \| 'hu';\n", "", s, flags=re.M)
    if s!=o:
        need=[n for n in ['tx','pick','langOf'] if re.search(r'\b'+n+r'\(', s) and not re.search(r'\b(function|const) '+n+r'\b', s)]
        if re.search(r'\bLang\b', s): need.append('type Lang')
        have=set()
        for m in re.finditer(r"import (?:type )?\{([^}]*)\} from '[^']*(?:i18n|/tr|InfoPage|LangPicker)'", s):
            have |= {x.strip().replace('type ','') for x in m.group(1).split(',')}
        add=[n for n in need if n.replace('type ','') not in have]
        if add:
            line=f"import {{ {', '.join(add)} }} from '@/lib/tr';\n"
            if s.startswith("'use client'"):
                i=s.index('\n')+1; s=s[:i]+line+s[i:]
            else: s=line+s
        open(p,'w').write(s)
