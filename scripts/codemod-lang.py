import re, os, sys
root='.'
files=[]
for d in ['app','lib']:
    for dp,dn,fn in os.walk(d):
        for f in fn:
            if f.endswith(('.ts','.tsx')) and 'locales' not in dp: files.append(os.path.join(dp,f))
V=r"(ui\.lang|lang|L|l|sel|lng)"
S=r"('(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|\"(?:[^\"\\\n]|\\.)*\")"
changed=0
for p in files:
    s=open(p).read(); o=s
    # local helpers
    s=re.sub(r"\(en: string, (hu|h)\) => \(("+V[1:-1]+r") === 'hu' \? \1 : en\)", lambda m: f"(en: string, {m.group(1)}) => tx({m.group(2)}, en, {m.group(1)})", s)
    s=re.sub(r"\(lang: Lang, en: string, hu: string\) => \(lang === 'hu' \? hu : en\)", "(lang: Lang, en: string, hu: string) => tx(lang, en, hu)", s)
    # ?lang= suffixes
    s=re.sub(r"(!onLang && )?"+V+r" === 'en' \? '\?lang=en' : ''", lambda m: (f"(onLang ? '' : qOf({m.group(2)}))" if m.group(1) else f"qOf({m.group(2)})"), s)
    s=re.sub(V+r" === 'hu' \? '' : '\?lang=en'", lambda m: f"qOf({m.group(1)})", s)
    s=re.sub(r"searchParams\.lang === 'hu' \? '' : '\?lang=en'", "qOf(langOf(searchParams))", s)
    s=re.sub(V+r" === 'en' \? '(/[^'?]*)\?lang=en' : '\2'", lambda m: f"`{m.group(2)}${{qOf({m.group(1)})}}`", s)
    s=re.sub(V+r" === 'hu' \? '(/[^'?]*)' : '\2\?lang=en'", lambda m: f"`{m.group(2)}${{qOf({m.group(1)})}}`", s)
    s=re.sub(r"\$\{"+V+r" === 'en' \? '\?lang=en' : ''\}", lambda m: f"${{qOf({m.group(1)})}}", s)
    s=re.sub(r"\$\{"+V+r" === 'hu' \? '' : '\?lang=en'\}", lambda m: f"${{qOf({m.group(1)})}}", s)
    # dates
    s=re.sub(V+r" === 'hu' \? 'hu-HU' : 'en-GB'", lambda m: f"localeOf({m.group(1)})", s)
    # page language from ?lang
    s=re.sub(r"searchParams\.lang === 'en' \? 'en' : 'hu'", "langOf(searchParams)", s)
    # {en,hu} picks
    s=re.sub(V+r" === 'hu' \? ([\w.\[\]]+)\.hu : \2\.en", lambda m: f"pick({m.group(2)}, {m.group(1)})", s)
    # simple string ternaries
    s=re.sub(V+r" === 'hu' \? "+S+r" : "+S, lambda m: f"tx({m.group(1)}, {m.group(3)}, {m.group(2)})", s)
    s=re.sub(V+r" === 'en' \? "+S+r" : "+S, lambda m: f"tx({m.group(1)}, {m.group(2)}, {m.group(3)})", s)
    # types
    s=s.replace("lang: 'en' | 'hu'","lang: Lang").replace("lang?: 'en' | 'hu'","lang?: Lang")
    if s!=o:
        # imports
        need=[n for n in ['tx','qOf','localeOf','langOf','pick'] if re.search(r'\b'+n+r'\(', s) and not re.search(r'\b(function|const) '+n+r'\b', s)]
        if 'Lang' in s and re.search(r'\bLang\b', s) and not re.search(r'(type|import[^;]*)\bLang\b', s): need.append('type Lang')
        have=set()
        for m in re.finditer(r"import \{([^}]*)\} from '(@/lib/(?:i18n|tr)|\.\.?/[^']*(?:i18n|tr))'", s):
            have |= {x.strip().replace('type ','') for x in m.group(1).split(',')}
        add=[n for n in need if n.replace('type ','') not in have]
        if add and p not in ('lib/tr.ts','lib/i18n.ts'):
            rel='@/lib/tr'
            line=f"import {{ {', '.join(add)} }} from '{rel}';\n"
            if s.startswith("'use client'"):
                i=s.index('\n')+1; s=s[:i]+line+s[i:]
            else: s=line+s
        open(p,'w').write(s); changed+=1
print('changed', changed)
