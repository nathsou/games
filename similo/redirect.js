const destination = new URL('../cluance/', location.href);
destination.search = location.search;
destination.hash = location.hash;
location.replace(destination.href);
