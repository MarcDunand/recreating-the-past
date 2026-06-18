import re
from urllib.parse import urlparse, parse_qs, unquote

def clean_google_url(url):
    if 'google.com/url' in url:
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        if 'q' in qs:
            return unquote(qs['q'][0])
    return url

# Data extracted from HTML parse
students = [
    {
        'name': 'Sun',
        'orig_link': 'https://www.google.com/url?q=http://playtime.pem.org/art-for-the-ages-an-image-gallery/&sa=D&source=editors',
        'rec_link': 'https://www.google.com/url?q=https://code.chuanqisun.com/recreating-the-past/salavon/demo.html&sa=D&source=editors',
        'orig_img': 'image64.png', 'rec_img': 'image45.png',
        'label': 'Original → Recreated',
    },
    {
        'name': 'Anyang Zu',
        'orig_link': 'https://www.google.com/url?q=https://www.katevassgalerie.com/print/p/nancy-burson-polaroids-4&sa=D&source=editors',
        'rec_link': '',
        'orig_img': 'image7.png', 'rec_img': 'image21.gif',
        'label': 'Nancy Burson Polaroids',
    },
    {
        'name': 'Lia Chen',
        'orig_link': 'https://www.google.com/url?q=https://www.metmuseum.org/art/collection/search?q%3DJason%2BSalavon%26searchField%3DArtistCulture&sa=D&source=editors',
        'rec_link': '',
        'orig_img': 'image46.png', 'rec_img': 'image14.png',
        'label_orig': 'Jason Salavon, Portrait (Hals)',
        'label_rec': 'composite of Caravaggio portraits (p5.js)',
    },
    {
        'name': 'Aimee Ye',
        'orig_link': 'https://www.google.com/url?q=https://www.moma.org/collection/works/183529&sa=D&source=editors',
        'rec_link': 'https://www.google.com/url?q=https://editor.p5js.org/aimeeye/full/s-BxjRMnK&sa=D&source=editors',
        'orig_img': 'image8.png', 'rec_img': 'image26.png',
    },
    {
        'name': 'Annie Chen',
        'orig_link': 'https://www.google.com/url?q=https://www.cartermuseum.org/collection/class-1988-p20172&sa=D&source=editors',
        'rec_link': '',
        'orig_img': 'image60.png', 'rec_img': 'image28.jpg',
        'label': 'Class of 1988 (Carter Museum)',
    },
    {
        'name': 'Alex Dang',
        'orig_link': '', 'rec_link': '',
        'orig_img': 'image39.png', 'rec_img': 'image38.png',
    },
    {
        'name': 'Ana Schon',
        'orig_link': '',
        'rec_link': 'https://www.google.com/url?q=https://github.com/anaschonml/RTP-code/tree/main/faces&sa=D&source=editors',
        'orig_img': 'image63.png', 'rec_img': 'image37.png',
        'label': 'Jason Salavon - Class of 1988 & class of 1967',
    },
    {
        'name': 'Yufeng Zhao',
        'orig_link': '', 'rec_link': '',
        'orig_img': 'image47.png', 'rec_img': 'image57.png',
        'label': 'Claire Hentschker, Biker on the Road, 2017',
    },
    {
        'name': 'Shiman Xu',
        'orig_link': '',
        'rec_link': 'https://www.google.com/url?q=https://editor.p5js.org/shimanxxx/full/3fJYjjezE&sa=D&source=editors',
        'orig_img': 'image43.png', 'rec_img': 'image1.png',
        'label': 'Morphing Grid, 1979 (Nancy Burson)',
    },
    {
        'name': 'Jae In Yoo',
        'orig_link': '', 'rec_link': '',
        'orig_img': 'image70.png', 'rec_img': 'image13.jpg',
        'rec_imgs_all': ['image13.jpg', 'image23.jpg', 'image6.jpg', 'image34.jpg'],
    },
    {
        'name': 'Emily Guan',
        'orig_link': '', 'rec_link': 'https://www.google.com/url?q=https://colab.research.google.com/drive/12CoPp1Pmr4ljsFvNnQBBe02p2ohgUS4B?usp%3Dsharing&sa=D&source=editors',
        'orig_img': 'image68.png', 'rec_img': 'image54.gif',
        'label': 'Morphing Grid, 1979 by Nancy Burson',
    },
    {
        'name': 'Eitan Wolf',
        'orig_link': '',
        'rec_link': '',
        'orig_img': 'image25.png', 'rec_img': 'image67.png',
        'orig_example_link': 'https://www.google.com/url?q=https://happycoding.io/gallery/movie-colors/index&sa=D&source=editors',
        'label': 'Jason Salavon movie color averaging',
    },
    {
        'name': 'Ash He',
        'orig_link': 'https://www.google.com/url?q=https://www.hallmarkartcollection.com/wp/wp-content/uploads/2014/07/Salavon_NewlyWeds_mainNEWBORDER.jpg&sa=D&source=editors',
        'rec_link': 'https://www.google.com/url?q=https://editor.p5js.org/kevin1753008444/full/wFDyxX-Df&sa=D&source=editors',
        'orig_img': 'image44.png', 'rec_img': 'image35.png',
        'label': 'Jason Salavon Newlyweds',
    },
    {
        'name': 'Fengyi Ye',
        'orig_link': 'https://www.google.com/url?q=https://www.artsy.net/article/artsy-jason-salavon-taps-into-the-simpsons-and-wikipedia-to-explore-our-changing-digital-landscape&sa=D&source=editors',
        'rec_link': 'https://www.google.com/url?q=https://editor.p5js.org/fengyiye68/full/yUyuTKTkv&sa=D&source=editors',
        'orig_img': 'image20.png', 'rec_img': 'image55.png',
    },
    {
        'name': 'Vivian Kong',
        'orig_link': 'https://www.google.com/url?q=https://www.artsy.net/article/artsy-jason-salavon-taps-into-the-simpsons-and-wikipedia-to-explore-our-changing-digital-landscape&sa=D&source=editors',
        'rec_link': 'https://www.google.com/url?q=https://github.com/vivian20206/JasonSalavon/blob/e2992f454bce9761af99fd02faddc8933174961b/src/ofApp.cpp&sa=D&source=editors',
        'orig_img': 'image31.png', 'rec_img': 'image48.png',
    },
    {
        'name': 'Ivy Zheng',
        'orig_link': '',
        'rec_link': 'https://www.google.com/url?q=https://github.com/ivyzhn/Nancy-Burson-Jason-Salavon.git&sa=D&source=editors',
        'orig_img': 'image11.png', 'rec_img': 'image50.jpg',
    },
    {
        'name': 'Haotian Wang',
        'orig_link': '',
        'rec_link': 'https://www.google.com/url?q=https://editor.p5js.org/wht1278349100/full/vJ5ahqpjA&sa=D&source=editors',
        'orig_img': 'image4.png', 'rec_img': 'image12.png',
    },
]

print("=== CLEAN URLS ===")
for s in students:
    print(f"\n{s['name']}:")
    print(f"  orig: {s['orig_img']} / {clean_google_url(s.get('orig_link', ''))}")
    print(f"  rec:  {s['rec_img']} / {clean_google_url(s.get('rec_link', ''))}")
    if 'label' in s:
        print(f"  label: {s['label']}")
    if 'label_orig' in s:
        print(f"  label_orig: {s['label_orig']}")
    if 'orig_example_link' in s:
        print(f"  orig_example_link: {clean_google_url(s['orig_example_link'])}")
