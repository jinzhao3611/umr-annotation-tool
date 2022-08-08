from umr_annot_tool import create_app

app = create_app()

# migrate=Migrate(app,db)
# manager=Manager(app)
# manager.add_command('db',MigrateCommand)
if __name__ == '__main__':
    # manager.run()
    app.run(debug=True, port=8000)
