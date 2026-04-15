import urllib.request
from bs4 import BeautifulSoup

url = "https://immo.swp.de/suche/wohnungen-mieten/stuttgart-stadt"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
res = urllib.request.urlopen(req)
soup = BeautifulSoup(res.read(), 'html.parser')

items = soup.find_all('div', class_='featured-listings__item')
print(f"Found {len(items)} items")

for item in items[:2]:
    title_el = item.find('div', class_='featured-listings__item__title')
    title = title_el.text.strip() if title_el else "No title"
    print("Title:", title)
    
    price_el = item.find('p', class_='featured-listings__item__price')
    price = price_el.text.strip() if price_el else "No price"
    print("Price:", price)
    
    link_el = item.find('a')
    url = link_el['href'] if link_el else ''
    print("Link:", url)
