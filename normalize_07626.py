import re
import xml.etree.ElementTree as ET
from pathlib import Path

def strip_ns(t):
    return t.split("}",1)[-1]

def parse_vb(v):
    p=re.split(r"[, \t\r\n]+",(v or "").strip())
    if len(p)==4:
        return float(p[0]),float(p[1]),float(p[2]),float(p[3])
    return 0.0,0.0,100.0,100.0

tree=ET.parse("07626.raw.svg")
root=tree.getroot()
x,y,w,h=parse_vb(root.attrib.get("viewBox",""))
sx=100.0/w if w else 1.0
sy=100.0/h if h else 1.0

ds=[]
for el in root.iter():
    if strip_ns(el.tag)=="path" and el.attrib.get("d"):
        ds.append(el.attrib["d"].strip())

out=ET.Element("svg",{"xmlns":"http://www.w3.org/2000/svg","viewBox":"0 0 100 100"})
g=ET.SubElement(out,"g",{"fill":"none","stroke":"black","stroke-width":"3","stroke-linecap":"round","stroke-linejoin":"round","transform":f"translate({-x},{-y}) scale({sx},{sy})"})
for i,d in enumerate(ds,1):
    ET.SubElement(g,"path",{"id":f"s{i}","d":d})

xml='<?xml version="1.0" encoding="UTF-8"?>'+"\\n"+ET.tostring(out,encoding="unicode")
Path("07626.svg").write_text(xml,encoding="utf-8")
print("OK created 07626.svg paths=",len(ds))
