import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { LogOut, User, Phone, MapPin, Building2, Shield } from "lucide-react";

export default function Profile() {
  const { currentUser, logout } = useStore();

  if (!currentUser) return null;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 md:px-6 pt-6 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your personal and company details</p>
        </div>
      </div>

      <div className="card-elevated p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-primary">{currentUser.name[0]?.toUpperCase()}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{currentUser.name}</h2>
            <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1 capitalize">
              <Shield className="w-4 h-4" /> {currentUser.designation}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Phone Number</p>
              <p className="text-sm text-muted-foreground mt-0.5">{currentUser.phoneNumber || "Not provided"}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Address</p>
              <p className="text-sm text-muted-foreground mt-0.5">{currentUser.address || "Not provided"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card-elevated p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Company Details</h3>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">Company Name</p>
            <p className="text-sm text-muted-foreground mt-0.5">ChemPack Industries</p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Role / Access</p>
            <p className="text-sm text-muted-foreground mt-0.5 capitalize">{currentUser.designation} Access Level</p>
          </div>
        </div>
      </div>

      <Button 
        variant="destructive" 
        className="w-full sm:w-auto gap-2" 
        onClick={() => logout()}
      >
        <LogOut className="w-4 h-4" />
        Log Out
      </Button>
    </div>
  );
}
