import urllib.request
try:
    req = urllib.request.Request("http://127.0.0.1:8005/api/v1/governance/proposals")
    with urllib.request.urlopen(req) as response:
        print(response.status)
        print(response.read())
except Exception as e:
    print(e)
