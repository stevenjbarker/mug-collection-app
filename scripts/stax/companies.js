// Real companies behind the "individual stocks" in Stax. Players only see a
// made-up name and a plain description of the business: the industry and
// its situation at the time, never a famous product, founder, logo or slogan.
// The real name is revealed on the results screen.
//
// A blurb can be a list of [fromYear, text] so it fits the era the game
// starts in. Ids are neutral so the API doesn't hint at the company either.
export const COMPANIES = [
  { ticker: 'KO', id: 'c01', name: 'Meridian Beverage Group',
    blurb: 'Sells soft drinks and other beverages in over 100 countries. Slow, steady growth and a reliable dividend.' },
  { ticker: 'AAPL', id: 'c02', name: 'Northgate Systems', blurb: [
    [0, 'A personal-computer maker with loyal customers but a small share of the market. Its future is uncertain.'],
    [1997, 'A personal-computer maker that has been losing money and market share. New management is attempting a turnaround.'],
    [2002, 'A computer maker that has started selling consumer electronics. Sales of its newer products are growing quickly.'],
    [2008, 'A consumer-electronics company selling phones, computers and accessories worldwide. Very profitable.'],
  ] },
  { ticker: 'MSFT', id: 'c03', name: 'Halberd Software', blurb: [
    [0, 'A young software company that licenses its programs to computer makers and businesses. Growing extremely fast.'],
    [1993, 'A large, very profitable software company whose programs run on most personal computers.'],
    [2002, 'A very large software company whose products are used in most offices. Lots of cash, but growth is slowing.'],
    [2015, 'A large software company moving its customers to online subscriptions and renting out computing power.'],
  ] },
  { ticker: 'IBM', id: 'c04', name: 'Consolidated Data Corp.', blurb: [
    [0, 'One of the largest technology companies in the world. Sells computers and services to big businesses and governments.'],
    [1995, 'A long-established technology giant shifting from building computers to selling software and consulting.'],
  ] },
  { ticker: 'GE', id: 'c05', name: 'Atlas Industries',
    blurb: 'A huge conglomerate with businesses in manufacturing, energy equipment, media and lending. Widely seen as safe and well run.' },
  { ticker: 'XOM', id: 'c06', name: 'Granite Petroleum',
    blurb: 'A large oil and gas producer with refineries around the world. Profits rise and fall with oil prices.' },
  { ticker: 'WMT', id: 'c07', name: 'Prairie Retail', blurb: [
    [0, 'A fast-growing chain of discount stores expanding across the country.'],
    [1995, 'A very large discount retailer with thousands of stores. Competes on low prices.'],
  ] },
  { ticker: 'MCD', id: 'c08', name: 'Crossroads Restaurants',
    blurb: 'Runs and franchises a large chain of fast-food restaurants in the U.S. and overseas.' },
  { ticker: 'DIS', id: 'c09', name: 'Starlight Entertainment',
    blurb: 'An entertainment company with a movie studio, TV channels, and vacation resorts.' },
  { ticker: 'NKE', id: 'c10', name: 'Velocity Sportswear',
    blurb: 'Designs athletic shoes and clothing made by factories overseas, and spends heavily on advertising.' },
  { ticker: 'INTC', id: 'c11', name: 'Quartz Semiconductor',
    blurb: 'Designs and manufactures computer chips. A leader in its field, but competition is fierce and factories are expensive.' },
  { ticker: 'HPQ', id: 'c12', name: 'Bayline Instruments', blurb: [
    [0, 'Makes electronic instruments, calculators and computer equipment for engineers and businesses.'],
    [1995, 'Sells personal computers and printers to homes and businesses. Margins are thin on computers.'],
  ] },
  { ticker: 'XRX', id: 'c13', name: 'Sterling Office Products', blurb: [
    [0, 'Makes and leases copiers and printers to businesses.'],
    [2002, 'An office-equipment maker under pressure as businesses use less paper.'],
  ] },
  { ticker: 'F', id: 'c14', name: 'Keystone Motor Co.',
    blurb: 'A large car and truck manufacturer. Sales swing with the economy and gas prices.' },
  { ticker: 'BA', id: 'c15', name: 'Horizon Aerospace',
    blurb: 'Builds airliners for airlines and aircraft for the military. Orders are huge but slow and unpredictable.' },
  { ticker: 'HD', id: 'c16', name: 'Benchmark Home Supply',
    blurb: 'A chain of large home-improvement stores selling building materials, tools and garden supplies.' },
  { ticker: 'JNJ', id: 'c17', name: 'Whitfield Health',
    blurb: 'A diversified health-care company: household health products, medical devices, and prescription drugs.' },
  { ticker: 'PG', id: 'c18', name: 'Hearthstone Consumer Goods',
    blurb: 'Makes everyday household and personal-care products sold in grocery stores worldwide.' },
  { ticker: 'C', id: 'c19', name: 'Union Commerce Bank',
    blurb: 'One of the largest banks in the country: savings accounts, credit cards, mortgages and trading.' },
  { ticker: 'AIG', id: 'c20', name: 'Bulwark Insurance Group',
    blurb: 'A very large insurance company that also sells complex financial contracts to other banks.' },
  { ticker: 'CSCO', id: 'c21', name: 'Lattice Networks', blurb: [
    [0, 'A young company making equipment that connects computer networks together. Growing very fast.'],
    [1996, 'Makes the equipment that connects computer networks, and sales are booming as businesses get online.'],
    [2002, 'Makes networking equipment for businesses and phone companies. Its stock soared, then fell hard.'],
  ] },
  { ticker: 'SBUX', id: 'c22', name: 'Copperline Cafés', blurb: [
    [0, 'A small but fast-growing chain of specialty coffee shops.'],
    [2005, 'A large chain of coffee shops still opening new locations around the world.'],
  ] },
  { ticker: 'AMZN', id: 'c23', name: 'Riverbend Commerce', blurb: [
    [0, 'A brand-new internet retailer. Sales are growing fast, but it is losing money.'],
    [2002, 'An online retailer selling a wide range of products. Customers like it; profits are thin.'],
    [2010, 'A huge online retailer that also sells computing services to other companies. It reinvests nearly everything it earns.'],
  ] },
  { ticker: 'NVDA', id: 'c24', name: 'Prism Microdevices', blurb: [
    [0, 'A young chip company designing graphics processors for personal computers.'],
    [2016, 'Designs graphics chips. Researchers are finding new uses for them beyond graphics.'],
  ] },
  { ticker: 'NFLX', id: 'c25', name: 'Marquee Media', blurb: [
    [0, 'A small company that rents movies to subscribers by mail.'],
    [2009, 'A movie-rental service moving its subscribers to watching over the internet.'],
    [2014, 'An internet TV service with millions of subscribers, spending heavily on its own shows.'],
  ] },
  { ticker: 'GOOGL', id: 'c26', name: 'Beacon Internet', blurb: [
    [0, 'A newly public internet company whose main service is free to use. It makes its money from advertising.'],
    [2010, 'A large internet company that earns most of its money from online advertising.'],
  ] },
];
