using UnrealBuildTool;

public class PlayWeldEditor : ModuleRules
{
    public PlayWeldEditor(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PrivateDependencyModuleNames.AddRange(new string[] {
            "Core", "CoreUObject", "Engine", "UnrealEd", "Json", "HTTPServer", "Sockets"
        });
        if (Target.Platform == UnrealTargetPlatform.Win64)
        {
            PublicSystemLibraries.Add("Crypt32.lib");
        }
    }
}
