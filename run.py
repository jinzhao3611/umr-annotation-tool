from umr_annot_tool import create_app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=3000)
