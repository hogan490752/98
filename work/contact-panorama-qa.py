from pathlib import Path
from PIL import Image, ImageDraw

root=Path(__file__).resolve().parent
rooms=['living','dining','kitchen','master','bedroom-north','bedroom-south','small-room','balcony','bath-west','bath-east','entrance']
for theme in ['warm','minimal','urban']:
    sheet=Image.new('RGB',(1200,1216),'white')
    draw=ImageDraw.Draw(sheet)
    for index,room in enumerate(rooms):
        path=root/f'qa-{theme}-{room}.png'
        if not path.exists():continue
        with Image.open(path) as image:
            image.thumbnail((400,278))
            col,row=index%3,index//3
            sheet.paste(image,(col*400,row*304+26))
            draw.text((col*400+10,row*304+7),f'{theme} / {room}',fill='black')
    sheet.save(root/f'qa-contact-{theme}.jpg',quality=92)
