#!/usr/bin/env python3
"""Regenerates the e2e import fixtures (run from this directory)."""
import zipfile

# Legacy Windows Arabic encoding (as saved by old editors).
with open('cp1256.txt', 'wb') as f:
    f.write('مرحباً بكم في الملقّن\nهذا ملف بترميز عربي قديم.'.encode('cp1256'))

with open('sample.md', 'w', encoding='utf-8') as f:
    f.write('# العنوان\n\nنص **عريض** مع [رابط](https://example.com).\n\n- بند أول\n- بند ثانٍ\n')

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
parts = {
    '[Content_Types].xml': '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>''',
    '_rels/.rels': '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>''',
    'word/_rels/document.xml.rels': '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>''',
    'word/styles.xml': f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="{W}">
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
</w:styles>''',
    'word/document.xml': f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W}">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/><w:bidi/></w:pPr><w:r><w:t>المقدمة</w:t></w:r></w:p>
    <w:p><w:pPr><w:bidi/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>مرحباً</w:t></w:r><w:r><w:t xml:space="preserve"> بكم في الحلقة.</w:t></w:r></w:p>
  </w:body>
</w:document>''',
}
with zipfile.ZipFile('sample.docx', 'w', zipfile.ZIP_DEFLATED) as z:
    for name, content in parts.items():
        z.writestr(name, content.encode('utf-8'))
print('fixtures written')
