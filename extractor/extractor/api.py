import functions_framework


@functions_framework.http("GET")
def hello_get(request):
    return "Hello, World!"